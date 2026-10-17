"""Delete every item in a DynamoDB table.

The table resource stays (key schema, indexes, billing, TTL, streams). Every
stored item is removed. The script reads the key schema from DescribeTable, so
it works for the main single table and for the session or activity log tables.

Credentials and the default table come from the environment, including the
repo `.env` when those variables are not already set. Region lookup matches
the other scripts: AWS_DYNAMODB_REGION, then AWS_REGION, then
AWS_DEFAULT_REGION.

Usage (from mapua-apex-frontend):

    python scripts/clear_dynamodb_table.py --dry-run
    python scripts/clear_dynamodb_table.py
    python scripts/clear_dynamodb_table.py --yes --table mapua-apex
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from botocore.exceptions import BotoCoreError, ClientError


def load_dotenv_fallback() -> None:
    """Load the nearest `.env` without overriding variables already in the process."""
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):
        env_file = os.path.join(current, ".env")
        if os.path.isfile(env_file):
            with open(env_file, "r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = value
            return
        current = os.path.dirname(current)


load_dotenv_fallback()

TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", os.environ.get("DYNAMODB_TABLE", "mapua-apex"))
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
DYNAMODB_ENDPOINT = (os.environ.get("DYNAMODB_ENDPOINT") or os.environ.get("AWS_ENDPOINT") or "").strip() or None

# A live writer can insert rows between passes. Stop rather than loop forever.
_MAX_PASSES = 20


def _resource():
    kwargs: dict[str, Any] = {"region_name": AWS_REGION}
    if DYNAMODB_ENDPOINT:
        kwargs["endpoint_url"] = DYNAMODB_ENDPOINT
    return boto3.resource("dynamodb", **kwargs)


def _table(table_name: str):
    return _resource().Table(table_name)


def _key_names(table) -> list[str]:
    """HASH, then RANGE when the table has a sort key."""
    description = table.meta.client.describe_table(TableName=table.name)["Table"]
    schema = description["KeySchema"]
    ordered = sorted(schema, key=lambda entry: 0 if entry["KeyType"] == "HASH" else 1)
    return [entry["AttributeName"] for entry in ordered]


def _scan_kwargs(key_names: list[str]) -> dict[str, Any]:
    names = {f"#k{index}": name for index, name in enumerate(key_names)}
    return {
        "ProjectionExpression": ", ".join(names),
        "ExpressionAttributeNames": names,
        "ConsistentRead": True,
    }


def _key_pages(table, key_names: list[str]) -> Iterator[list[dict[str, Any]]]:
    """Yield each Scan page as a list of primary keys."""
    kwargs = _scan_kwargs(key_names)
    start = None
    while True:
        if start:
            kwargs["ExclusiveStartKey"] = start
        response = table.scan(**kwargs)
        keys = []
        for item in response.get("Items", []):
            missing = [name for name in key_names if name not in item]
            if missing:
                raise RuntimeError(f"Scanned item is missing key attribute(s) {missing}: {item!r}")
            keys.append({name: item[name] for name in key_names})
        if keys:
            yield keys
        start = response.get("LastEvaluatedKey")
        if not start:
            return


def clear_table(table_name: str = TABLE_NAME, dry_run: bool = False, table=None) -> dict[str, Any]:
    """Delete every item in `table_name`.

    Scans with a strongly consistent read and deletes each page. Repeats until
    a pass finds nothing, so rows written during an earlier pass are removed too.

    Returns a summary with the table name, whether this was a dry run, how many
    items were deleted (or would be), and how many scan passes ran.
    """
    table = table or _table(table_name)
    key_names = _key_names(table)
    deleted = 0
    passes = 0

    while passes < _MAX_PASSES:
        passes += 1
        found = 0
        if dry_run:
            for page in _key_pages(table, key_names):
                found += len(page)
            deleted = found
            break

        for page in _key_pages(table, key_names):
            with table.batch_writer() as batch:
                for key in page:
                    batch.delete_item(Key=key)
            found += len(page)
            deleted += len(page)
            print(f"  deleted {deleted} item(s)...", flush=True)

        if found == 0:
            break
    else:
        raise RuntimeError(
            f"'{table.name}' still returned items after {_MAX_PASSES} passes. "
            "Something is writing to the table while it is being cleared."
        )

    return {
        "table": table.name,
        "region": AWS_REGION,
        "dry_run": dry_run,
        "deleted": deleted,
        "passes": passes,
        "keys": key_names,
    }


def _approximate_count(table) -> int | None:
    try:
        return int(table.item_count)
    except (ClientError, BotoCoreError, TypeError, ValueError):
        return None


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Delete every item in a DynamoDB table. The table itself is kept.")
    parser.add_argument("--table", default=TABLE_NAME, help=f"DynamoDB table name (default: {TABLE_NAME}).")
    parser.add_argument("--dry-run", action="store_true", help="Count items only. Delete nothing.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    table_name = args.table.strip()
    if not table_name:
        print("error: table name is empty.", file=sys.stderr)
        return 1

    table = _table(table_name)
    try:
        key_names = _key_names(table)
    except ClientError as error:
        print(f"error: cannot read table '{table_name}': {error}", file=sys.stderr)
        return 1

    approximate = _approximate_count(table)
    count_label = "unknown" if approximate is None else str(approximate)
    endpoint = DYNAMODB_ENDPOINT or "(AWS default)"
    print(f"Table:    {table.name}")
    print(f"Region:   {AWS_REGION}")
    print(f"Endpoint: {endpoint}")
    print(f"Keys:     {', '.join(key_names)}")
    print(f"DescribeTable item count (approximate, can be hours stale): {count_label}")

    if not args.dry_run and not args.yes:
        answer = input(
            f"\nThis permanently deletes EVERY item in '{table.name}'. Type the table name to confirm: "
        ).strip()
        if answer != table.name:
            print("Aborted; nothing was deleted.")
            return 1

    try:
        summary = clear_table(table_name=table.name, dry_run=args.dry_run, table=table)
    except (ClientError, BotoCoreError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    action = "Would delete" if summary["dry_run"] else "Deleted"
    print(f"{action} {summary['deleted']} item(s) from '{summary['table']}' in {summary['passes']} pass(es).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
