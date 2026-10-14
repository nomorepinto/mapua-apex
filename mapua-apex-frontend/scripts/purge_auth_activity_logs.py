"""Purge auth activity log items (LOGIN and LOGOUT) from the DynamoDB ActivityLog table.

This script scans the ActivityLog DynamoDB table (or main single table) for records
where actionType is LOGIN, LOGOUT, login, or logout, and deletes them.

Auth events belong exclusively in the SessionLog table.

Usage:
    python scripts/purge_auth_activity_logs.py [--dry-run] [--yes] [--table TABLE_NAME]
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import BotoCoreError, ClientError

ACTIVITY_TABLE_NAME = os.environ.get(
    "AWS_DYNAMODB_ACTIVITY_LOG_TABLE",
    os.environ.get("AWS_DYNAMODB_TABLE", os.environ.get("DYNAMODB_TABLE", "mapua-apex-activity-log"))
)
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT", os.environ.get("AWS_ENDPOINT"))

AUTH_ACTIONS = ["LOGIN", "LOGOUT", "login", "logout"]


def _table(resource_or_none=None, table_name: str = ACTIVITY_TABLE_NAME):
    kwargs = {"region_name": AWS_REGION}
    if DYNAMODB_ENDPOINT:
        kwargs["endpoint_url"] = DYNAMODB_ENDPOINT
    resource = resource_or_none or boto3.resource("dynamodb", **kwargs)
    return resource.Table(table_name)


def _paginate(method, kwargs: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield items from a paginated Scan/Query."""
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


def purge_auth_logs(table_name: str = ACTIVITY_TABLE_NAME, dry_run: bool = False, yes: bool = False) -> dict[str, int]:
    table = _table(table_name=table_name)
    stats = {"scanned": 0, "deleted": 0}

    print(f"Scanning table '{table_name}' for LOGIN / LOGOUT activity items...")

    items_to_delete = []

    try:
        scan_kwargs = {
            "ProjectionExpression": "PK, SK, activityId, actionType, userName, userEmail, #ts",
            "ExpressionAttributeNames": {"#ts": "timestamp"},
        }
        
        for item in _paginate(table.scan, scan_kwargs):
            stats["scanned"] += 1
            action = str(item.get("actionType", "")).upper()
            if action in ["LOGIN", "LOGOUT"]:
                items_to_delete.append(item)
    except ClientError as e:
        print(f"Error scanning table '{table_name}': {e}", file=sys.stderr)
        return stats

    print(f"Found {len(items_to_delete)} LOGIN / LOGOUT activity items out of {stats['scanned']} total items scanned.")

    if not items_to_delete:
        print("No auth items to delete.")
        return stats

    for item in items_to_delete:
        pk = item.get("PK")
        sk = item.get("SK", pk)
        user = item.get("userName") or item.get("userEmail") or "Unknown"
        action = item.get("actionType")
        ts = item.get("timestamp", "N/A")
        print(f"  [{'DRY-RUN' if dry_run else 'TO DELETE'}] PK={pk}, Action={action}, User={user}, Time={ts}")

    if dry_run:
        print(f"\nDry run complete. {len(items_to_delete)} items identified for deletion.")
        return stats

    if not yes:
        confirm = input(f"\nAre you sure you want to delete these {len(items_to_delete)} items from '{table_name}'? (y/N): ")
        if confirm.lower() not in ["y", "yes"]:
            print("Operation cancelled.")
            return stats

    with table.batch_writer() as batch:
        for item in items_to_delete:
            key = {"PK": item["PK"]}
            if "SK" in item and item["SK"]:
                key["SK"] = item["SK"]
            batch.delete_item(Key=key)
            stats["deleted"] += 1

    print(f"\nSuccessfully purged {stats['deleted']} auth activity log items from table '{table_name}'.")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Purge LOGIN and LOGOUT items from DynamoDB ActivityLog table.")
    parser.add_argument("--dry-run", action="store_true", help="Preview items to delete without deleting them.")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip interactive prompt and proceed with deletion.")
    parser.add_argument("--table", type=str, default=ACTIVITY_TABLE_NAME, help="DynamoDB table name.")
    args = parser.parse_args()

    purge_auth_logs(table_name=args.table, dry_run=args.dry_run, yes=args.yes)


if __name__ == "__main__":
    main()
