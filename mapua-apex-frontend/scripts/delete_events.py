"""Cascade-delete EVENT items and everything attached to them from DynamoDB.

For every event partition (`PK = EVENT#<id>`) this removes:

    * the EVENT row itself,
    * every SUBMISSION in that event (same partition, `SK = SUBMISSION#<id>`),
    * every DEADLINE reminder in that event (`SK = DEADLINE#<id>`),
    * every NOTIFICATION for each of those submissions (a separate partition,
      `PK = SUBMISSION#<id>`, `SK = NOTIFICATION#<timestamp>`).

DynamoDB models the relationships by key, not foreign keys, so the cascade is
done by walking the partitions: query each event partition, then query the
notification partition for every submission found there.

Key layout (see `DynamoDB Schema.txt`):

    EVENT         PK = EVENT#<id>        SK = EVENT#<id>
    SUBMISSION    PK = EVENT#<id>        SK = SUBMISSION#<id>
    DEADLINE      PK = EVENT#<id>        SK = DEADLINE#<id>
    NOTIFICATION  PK = SUBMISSION#<id>   SK = NOTIFICATION#<timestamp>

`cascade_delete_all_events` is importable and returns a summary dict. Running
the module executes a CLI. The operation is destructive; without `--dry-run`
it asks for confirmation unless `--yes` is passed.

Example:

    from delete_events import cascade_delete_all_events

    summary = cascade_delete_all_events(dry_run=True)          # preview
    summary = cascade_delete_all_events(event="e001", yes=True)  # one event
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import BotoCoreError, ClientError

TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", os.environ.get("DYNAMODB_TABLE", "mapua-apex"))
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
# Optional custom endpoint (e.g. a local DynamoDB) mirrors config/aws.php.
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT", os.environ.get("AWS_ENDPOINT"))

EVENT_PREFIX = "EVENT#"
SUBMISSION_PREFIX = "SUBMISSION#"
# The notification partition key equals the submission item's sort key value.
NOTIFICATION_KEY_PREFIX = "SUBMISSION#"

_KEY_PROJECTION = {"ProjectionExpression": "#pk, #sk", "ExpressionAttributeNames": {"#pk": "PK", "#sk": "SK"}}


def _table(resource_or_none=None, table_name: str = TABLE_NAME):
    resource = resource_or_none or boto3.resource("dynamodb", region_name=AWS_REGION, endpoint_url=DYNAMODB_ENDPOINT)
    return resource.Table(table_name)


def _paginate(method, kwargs: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield items from a paginated Scan/Query, carrying ExclusiveStartKey forward."""
    start = None
    while True:
        if start:
            kwargs["ExclusiveStartKey"] = start
        response = method(**kwargs)
        for item in response.get("Items", []):
            yield item
        start = response.get("LastEvaluatedKey")
        if not start:
            return


def _partition_keys(table, pk: str) -> list[dict[str, str]]:
    """Return the {PK, SK} of every item in a base-table partition."""
    items = _paginate(
        table.query,
        {"KeyConditionExpression": Key("PK").eq(pk), "ConsistentRead": True, **_KEY_PROJECTION},
    )
    return [{"PK": item["PK"], "SK": item["SK"]} for item in items]


def _event_partition_keys(table) -> list[str]:
    """Distinct EVENT# partition keys, from scanning every item that lives in one."""
    keys = _paginate(
        table.scan,
        {"FilterExpression": Attr("PK").begins_with(EVENT_PREFIX), "ConsistentRead": True, **_KEY_PROJECTION},
    )
    seen: dict[str, None] = {}
    for item in keys:
        seen.setdefault(item["PK"], None)
    return list(seen)


def _delete_notifications(table, submission_sk: str, stats: dict[str, int], dry_run: bool) -> None:
    """Delete every NOTIFICATION under PK = SUBMISSION#<id> (the submission's SK)."""
    for key in _partition_keys(table, submission_sk):
        if not dry_run:
            table.delete_item(Key={"PK": key["PK"], "SK": key["SK"]})
        stats["notifications"] += 1


def _delete_event(table, event_pk: str, stats: dict[str, int], dry_run: bool) -> None:
    """Delete an event partition and cascade to each submission's notifications."""
    for key in _partition_keys(table, event_pk):
        sk = key["SK"]
        if sk.startswith(SUBMISSION_PREFIX):
            # Remove the paper's timeline first, then the submission item.
            _delete_notifications(table, sk, stats, dry_run)
            stats["submissions"] += 1
        elif sk.startswith("DEADLINE#"):
            stats["deadlines"] += 1
        elif sk == event_pk:
            stats["events"] += 1
        else:
            stats["other"] += 1

        if not dry_run:
            table.delete_item(Key={"PK": key["PK"], "SK": sk})


def _normalize_event_key(event: str) -> str:
    event = event.strip()
    if not event:
        raise ValueError("Event id is empty.")
    return event if event.startswith(EVENT_PREFIX) else EVENT_PREFIX + event


def cascade_delete_all_events(
    dry_run: bool = False,
    event: str | None = None,
    table=None,
) -> dict[str, Any]:
    """Delete all events (or one, when `event` is given) with their submissions and notifications.

    Args:
        dry_run: Count what would be removed without deleting anything.
        event: A single event id (`e001` or `EVENT#e001`). When omitted, every
            event in the table is targeted.
        table: An optional pre-built `boto3` Table; created from the module
            config when not supplied.

    Returns:
        A summary dict with the table name, mode, event count, and per-kind
        totals under `deleted` (events, submissions, deadlines, notifications, other).
    """
    table = table or _table()
    event_keys = [_normalize_event_key(event)] if event else _event_partition_keys(table)

    stats = {"events": 0, "submissions": 0, "deadlines": 0, "notifications": 0, "other": 0}
    for event_pk in event_keys:
        _delete_event(table, event_pk, stats, dry_run)

    return {
        "table": table.name,
        "dry_run": dry_run,
        "event_count": len(event_keys),
        "deleted": stats,
    }


def _format_summary(summary: dict[str, Any]) -> str:
    action = "Would delete" if summary["dry_run"] else "Deleted"
    totals = summary["deleted"]
    parts = [f"{totals['events']} event(s)", f"{totals['submissions']} submission(s)"]
    if totals["deadlines"]:
        parts.append(f"{totals['deadlines']} deadline(s)")
    parts.append(f"{totals['notifications']} notification(s)")
    if totals["other"]:
        parts.append(f"{totals['other']} other item(s)")
    return f"{action} across {summary['event_count']} event partition(s) in '{summary['table']}': " + ", ".join(parts) + "."


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Cascade-delete all events, their submissions, and each submission's notifications.",
    )
    parser.add_argument("--event", help="Delete only this event id (e.g. e001 or EVENT#e001). Default: all events.")
    parser.add_argument("--table", default=TABLE_NAME, help=f"DynamoDB table name (default: {TABLE_NAME}).")
    parser.add_argument("--dry-run", action="store_true", help="Report what would be deleted; delete nothing.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt (required for non-interactive use).")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    table = _table(table_name=args.table)

    if not args.dry_run and not args.yes:
        scope = f"event {args.event!r}" if args.event else "ALL events (and their submissions + notifications)"
        answer = input(f"This will permanently delete {scope} from '{table.name}'. Type 'yes' to confirm: ").strip().lower()
        if answer != "yes":
            print("Aborted; nothing was deleted.")
            return 1

    try:
        summary = cascade_delete_all_events(dry_run=args.dry_run, event=args.event, table=table)
    except (ClientError, BotoCoreError) as error:
        print(f"error: DynamoDB operation failed: {error}", file=sys.stderr)
        return 1

    print(_format_summary(summary))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
