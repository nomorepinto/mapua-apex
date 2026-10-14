"""Delete session log items for a specific user email from DynamoDB.

Usage:
    python scripts/delete_user_session_logs.py [--email EMAIL] [--dry-run] [--yes] [--table TABLE_NAME]
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

def load_dotenv_fallback():
    current = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):
        env_file = os.path.join(current, ".env")
        if os.path.isfile(env_file):
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v
            break
        current = os.path.dirname(current)

load_dotenv_fallback()

DEFAULT_EMAIL = "micotazarte@gmail.com"
TABLE_NAME = os.environ.get(
    "AWS_DYNAMODB_SESSION_LOG_TABLE",
    os.environ.get("AWS_DYNAMODB_TABLE", "mapua-apex")
)
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT", os.environ.get("AWS_ENDPOINT"))


def _table(table_name: str = TABLE_NAME):
    kwargs = {"region_name": AWS_REGION}
    if DYNAMODB_ENDPOINT:
        kwargs["endpoint_url"] = DYNAMODB_ENDPOINT
    if os.environ.get("AWS_ACCESS_KEY_ID") and os.environ.get("AWS_SECRET_ACCESS_KEY"):
        kwargs["aws_access_key_id"] = os.environ.get("AWS_ACCESS_KEY_ID")
        kwargs["aws_secret_access_key"] = os.environ.get("AWS_SECRET_ACCESS_KEY")
    resource = boto3.resource("dynamodb", **kwargs)
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


def delete_user_sessions(
    email: str = DEFAULT_EMAIL,
    table_name: str = TABLE_NAME,
    dry_run: bool = False,
    yes: bool = False,
    keep_current: bool = False,
    status_filter: str | None = None,
) -> dict[str, int]:
    table = _table(table_name=table_name)
    stats = {"scanned": 0, "deleted": 0}
    target_email = email.strip().lower()

    print(f"Scanning table '{table_name}' in region '{AWS_REGION}' for session logs of: {target_email}...")

    items_to_delete = []

    try:
        # Filter expression: PK begins with SESSION# AND (user_email = email OR userEmail = email)
        scan_kwargs = {
            "FilterExpression": (
                Attr("PK").begins_with("SESSION#")
                & (
                    Attr("user_email").eq(target_email)
                    | Attr("userEmail").eq(target_email)
                    | Attr("user_email").eq(email)
                    | Attr("userEmail").eq(email)
                )
            ),
            "ProjectionExpression": "PK, SK, session_id, sessionId, user_email, userEmail, user_name, userName, #st, login_time, #sub",
            "ExpressionAttributeNames": {"#st": "status", "#sub": "sub"},
        }

        for item in _paginate(table.scan, scan_kwargs):
            stats["scanned"] += 1
            items_to_delete.append(item)
    except ClientError as e:
        print(f"Error scanning table '{table_name}': {e}", file=sys.stderr)
        return stats

    print(f"Found {len(items_to_delete)} session log records for {email}.")

    if not items_to_delete:
        print("No matching session records found to delete.")
        return stats

    # Collect subs to clear active pointers
    subs_to_clear = set()
    for it in items_to_delete:
        s = it.get("sub")
        if s:
            subs_to_clear.add(s)

    # Sort items by login_time descending (newest first)
    items_to_delete.sort(key=lambda x: str(x.get("login_time", "")), reverse=True)

    # Apply filters
    if status_filter:
        allowed_statuses = [s.strip().lower() for s in status_filter.split(",")]
        items_to_delete = [
            it for it in items_to_delete
            if str(it.get("status", "")).lower() in allowed_statuses
        ]

    if keep_current:
        # Find the single most recent active session and preserve it
        most_recent_active = None
        for it in items_to_delete:
            if str(it.get("status", "")).lower() == "active":
                most_recent_active = it
                break

        if most_recent_active:
            print(f"Preserving most recent active session: PK={most_recent_active.get('PK')} (LoginTime={most_recent_active.get('login_time')})")
            items_to_delete = [it for it in items_to_delete if it["PK"] != most_recent_active["PK"]]
            # Don't clear active pointer if keeping current active session
            subs_to_clear.clear()

    if not items_to_delete:
        print("All matching records were filtered out or preserved. Nothing to delete.")
        return stats

    print(f"\n{len(items_to_delete)} session records queued for deletion:")
    for item in items_to_delete:
        pk = item.get("PK")
        sk = item.get("SK", "METADATA")
        status = item.get("status", "unknown")
        login_time = item.get("login_time", "N/A")
        print(f"  [{'DRY-RUN' if dry_run else 'TO DELETE'}] PK={pk}, SK={sk}, Status={status}, LoginTime={login_time}")

    if subs_to_clear and not keep_current:
        for s in subs_to_clear:
            print(f"  [{'DRY-RUN' if dry_run else 'TO DELETE'}] Pointer PK=USER#{s}, SK=ACTIVE_SESSION")

    if dry_run:
        print(f"\nDry run complete. {len(items_to_delete)} session items would be deleted.")
        return stats

    if not yes:
        confirm = input(f"\nAre you sure you want to delete these {len(items_to_delete)} session records from '{table_name}'? (y/N): ")
        if confirm.strip().lower() not in ["y", "yes"]:
            print("Aborted by user.")
            return stats

    print(f"\nDeleting {len(items_to_delete)} session items...")
    with table.batch_writer() as batch:
        for item in items_to_delete:
            pk = item["PK"]
            sk = item.get("SK", "METADATA")
            batch.delete_item(Key={"PK": pk, "SK": sk})
            stats["deleted"] += 1

    if subs_to_clear and not keep_current:
        for s in subs_to_clear:
            try:
                table.delete_item(Key={"PK": f"USER#{s}", "SK": "ACTIVE_SESSION"})
                print(f"Cleared active session pointer for USER#{s}.")
            except Exception as e:
                print(f"Warning: could not clear pointer for USER#{s}: {e}")

    print(f"Successfully deleted {stats['deleted']} session items.")
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete session logs for a specific user email.")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help=f"User email to delete sessions for (default: {DEFAULT_EMAIL})")
    parser.add_argument("--table", default=TABLE_NAME, help=f"DynamoDB table name (default: {TABLE_NAME})")
    parser.add_argument("--dry-run", action="store_true", help="Print matching records without deleting them")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
    parser.add_argument("--keep-current", action="store_true", help="Preserve the most recent active session and delete all older ones")
    parser.add_argument("--status", default=None, help="Filter deletion by comma-separated status (e.g. completed,timed_out)")

    args = parser.parse_args()
    delete_user_sessions(
        email=args.email,
        table_name=args.table,
        dry_run=args.dry_run,
        yes=args.yes,
        keep_current=args.keep_current,
        status_filter=args.status,
    )


if __name__ == "__main__":
    main()
