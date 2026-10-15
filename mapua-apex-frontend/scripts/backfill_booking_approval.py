"""One-time backfill for the BOOKING `approval_status` attribute.

SAAF-created holds (`source = "submission"`) are now written as
`approval_status = "pending"` and only occupy their slots once the CDM desk
approves the paper. Items written before that change carry no
`approval_status`, which the API reads as approved. Run this AFTER the new apex
code is deployed so the legacy holds on papers that are still in review stop
blocking slots.

For every `source = "submission"` BOOKING without an `approval_status`, the
linked SUBMISSION (`PK = EVENT#<event_id>`, `SK = SUBMISSION#<submission_id>`)
is read:

- `pending`               -> `approval_status = "pending"`
- any other status        -> `approval_status = "approved"`
- submission not found    -> left untouched and reported as orphaned

Manual CDM holds (`source = "cdm"`) always count and are never touched. Each
update is guarded by `attribute_not_exists(approval_status)`, so a re-run (or a
booking approved by CDM in the meantime) is a safe no-op.

The script only reports what it would change unless `--apply` is passed.

Example:

    from backfill_booking_approval import backfill_booking_approval

    summary = backfill_booking_approval()             # preview
    summary = backfill_booking_approval(apply=True)   # write
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import BotoCoreError, ClientError

TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", os.environ.get("DYNAMODB_TABLE", "mapua-apex"))
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
# Optional custom endpoint (e.g. a local DynamoDB) mirrors config/aws.php.
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT", os.environ.get("AWS_ENDPOINT"))

_BOOKING_FILTER = (
    Attr("PK").begins_with("RESERVABLE#")
    & Attr("SK").begins_with("BOOKING#")
    & Attr("source").eq("submission")
    & Attr("approval_status").not_exists()
)


def _table(resource_or_none=None, table_name: str = TABLE_NAME):
    resource = resource_or_none or boto3.resource("dynamodb", region_name=AWS_REGION, endpoint_url=DYNAMODB_ENDPOINT)
    return resource.Table(table_name)


def _paginate(method, kwargs: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield items from a paginated Scan, carrying ExclusiveStartKey forward."""
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


def _strip(value: Any, prefix: str) -> str:
    text = value if isinstance(value, str) else ""
    return text[len(prefix):] if text.startswith(prefix) else text


def _target_status(table, booking: dict[str, Any], cache: dict[tuple[str, str], str | None]) -> str | None:
    event_id = _strip(booking.get("event_id"), "EVENT#")
    submission_id = _strip(booking.get("submission_id"), "SUBMISSION#")
    if not event_id or not submission_id:
        return None

    key = (event_id, submission_id)
    if key not in cache:
        response = table.get_item(
            Key={"PK": f"EVENT#{event_id}", "SK": f"SUBMISSION#{submission_id}"},
            ConsistentRead=True,
        )
        submission = response.get("Item")
        cache[key] = submission.get("status") if submission else None

    status = cache[key]
    if status is None:
        return None
    return "pending" if status == "pending" else "approved"


def backfill_booking_approval(apply: bool = False, table=None) -> dict[str, Any]:
    """Stamp `approval_status` on legacy submission holds.

    Args:
        apply: Write the updates. When False, only count what would change.
        table: An optional pre-built `boto3` Table; created from the module
            config when not supplied.

    Returns:
        A summary dict with the table name, mode, and totals under `counts`.
    """
    table = table or _table()
    stats = {"found": 0, "pending": 0, "approved": 0, "orphaned": 0, "skipped_existing": 0}
    cache: dict[tuple[str, str], str | None] = {}

    bookings = list(_paginate(table.scan, {"FilterExpression": _BOOKING_FILTER, "ConsistentRead": True}))

    for booking in bookings:
        stats["found"] += 1
        target = _target_status(table, booking, cache)
        if target is None:
            stats["orphaned"] += 1
            continue

        if apply:
            try:
                table.update_item(
                    Key={"PK": booking["PK"], "SK": booking["SK"]},
                    UpdateExpression="SET approval_status = :status",
                    ConditionExpression="attribute_not_exists(approval_status)",
                    ExpressionAttributeValues={":status": target},
                )
            except ClientError as error:
                if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                    stats["skipped_existing"] += 1
                    continue
                raise

        stats[target] += 1

    return {"table": table.name, "apply": apply, "counts": stats}


def _format_summary(summary: dict[str, Any]) -> str:
    action = "Updated" if summary["apply"] else "Would update"
    counts = summary["counts"]
    parts = [f"{counts['pending']} pending", f"{counts['approved']} approved"]
    if counts["orphaned"]:
        parts.append(f"{counts['orphaned']} orphaned (no linked submission; left as-is)")
    if counts["skipped_existing"]:
        parts.append(f"{counts['skipped_existing']} already stamped")
    return (
        f"{action} in '{summary['table']}': {counts['found']} legacy submission booking(s) "
        f"({', '.join(parts)})."
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Stamp approval_status on legacy submission BOOKING items from their linked SUBMISSION status.",
    )
    parser.add_argument("--table", default=TABLE_NAME, help=f"DynamoDB table name (default: {TABLE_NAME}).")
    parser.add_argument("--apply", action="store_true", help="Write the updates (default is a dry run).")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    table = _table(table_name=args.table)

    try:
        summary = backfill_booking_approval(apply=args.apply, table=table)
    except (ClientError, BotoCoreError) as error:
        print(f"error: DynamoDB operation failed: {error}", file=sys.stderr)
        return 1

    print(_format_summary(summary))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
