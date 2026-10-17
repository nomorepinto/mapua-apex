"""Delete every user account in a Cognito user pool.

The user pool stays, including its groups, app clients, and attributes. Every
account is removed with AdminDeleteUser. Cognito can keep a deleted account
visible to ListUsers for a short time; the script keeps listing until the pool
is empty or until every remaining account has already been deleted.

The pool id comes from AWS_COGNITO_USER_POOL_ID, then COGNITO_USER_POOL_ID,
including the repo `.env` when those variables are not already set. The client
region is the region prefix of the pool id (ap-southeast-1_example).

Usage (from mapua-apex-frontend):

    python scripts/clear_cognito_users.py --dry-run
    python scripts/clear_cognito_users.py
    python scripts/clear_cognito_users.py --yes
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any

import boto3
from botocore.config import Config
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

USER_POOL_ID = (
    os.environ.get("AWS_COGNITO_USER_POOL_ID")
    or os.environ.get("COGNITO_USER_POOL_ID")
    or ""
).strip()

# ListUsers can still return an account after AdminDeleteUser succeeds.
_MAX_PASSES = 8
_SETTLE_SECONDS = 2


def _region_for_pool(pool_id: str) -> str:
    region, _, rest = pool_id.partition("_")
    if rest and region:
        return region
    return (
        os.environ.get("AWS_COGNITO_REGION")
        or os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "ap-southeast-1"
    )


def _client(region: str):
    return boto3.client(
        "cognito-idp",
        region_name=region,
        config=Config(retries={"max_attempts": 10, "mode": "adaptive"}),
    )


def _attribute(user: dict[str, Any], name: str) -> str:
    for attribute in user.get("Attributes") or []:
        if attribute.get("Name") == name:
            return str(attribute.get("Value") or "")
    return ""


def _label(user: dict[str, Any]) -> str:
    username = user.get("Username") or ""
    email = _attribute(user, "email")
    status = user.get("UserStatus") or ""
    if email and email != username:
        return f"{username} <{email}> [{status}]"
    return f"{username} [{status}]"


def _list_users(client, pool_id: str) -> list[dict[str, Any]]:
    users: list[dict[str, Any]] = []
    token = None
    while True:
        kwargs: dict[str, Any] = {"UserPoolId": pool_id, "Limit": 60}
        if token:
            kwargs["PaginationToken"] = token
        response = client.list_users(**kwargs)
        users.extend(response.get("Users") or [])
        token = response.get("PaginationToken")
        if not token:
            return users


def _delete_user(client, pool_id: str, username: str) -> None:
    try:
        client.admin_delete_user(UserPoolId=pool_id, Username=username)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code == "UserNotFoundException":
            return
        raise


def clear_users(pool_id: str = USER_POOL_ID, dry_run: bool = False, client=None) -> dict[str, Any]:
    """Delete every account in `pool_id`.

    Returns a summary with the pool id, whether this was a dry run, how many
    accounts were deleted (or would be), and how many accounts ListUsers still
    returned after those deletes.
    """
    pool_id = pool_id.strip()
    client = client or _client(_region_for_pool(pool_id))
    deleted_names: list[str] = []
    seen: set[str] = set()
    remaining = 0

    for attempt in range(_MAX_PASSES):
        users = _list_users(client, pool_id)
        if dry_run:
            for user in users:
                print(f"  would delete {_label(user)}")
            return {
                "user_pool_id": pool_id,
                "dry_run": True,
                "deleted": len(users),
                "still_listed": len(users),
            }

        pending = [user for user in users if user.get("Username") and user["Username"] not in seen]
        if not pending:
            remaining = len(users)
            if remaining == 0:
                break
            if attempt == _MAX_PASSES - 1:
                break
            time.sleep(_SETTLE_SECONDS)
            continue

        for user in pending:
            username = user["Username"]
            _delete_user(client, pool_id, username)
            seen.add(username)
            deleted_names.append(username)
            print(f"  deleted {len(deleted_names)}: {_label(user)}", flush=True)

    return {
        "user_pool_id": pool_id,
        "dry_run": False,
        "deleted": len(deleted_names),
        "still_listed": remaining,
    }


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Delete every user account in a Cognito user pool. The pool itself is kept.",
    )
    parser.add_argument(
        "--user-pool-id",
        default=USER_POOL_ID,
        help="Cognito user pool id (default: AWS_COGNITO_USER_POOL_ID or COGNITO_USER_POOL_ID).",
    )
    parser.add_argument("--dry-run", action="store_true", help="List accounts only. Delete nothing.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    pool_id = args.user_pool_id.strip()
    if not pool_id:
        print(
            "error: user pool id is empty. Set AWS_COGNITO_USER_POOL_ID or pass --user-pool-id.",
            file=sys.stderr,
        )
        return 1

    region = _region_for_pool(pool_id)
    client = _client(region)
    try:
        pool = client.describe_user_pool(UserPoolId=pool_id)["UserPool"]
        listed = _list_users(client, pool_id)
    except (ClientError, BotoCoreError) as error:
        print(f"error: cannot read user pool '{pool_id}': {error}", file=sys.stderr)
        return 1

    print(f"User pool: {pool_id}")
    print(f"Name:      {pool.get('Name') or ''}")
    print(f"Region:    {region}")
    print(f"Accounts:  {len(listed)}")

    if not args.dry_run and not args.yes:
        answer = input(
            f"\nThis permanently deletes EVERY account in '{pool_id}'. Type the user pool id to confirm: "
        ).strip()
        if answer != pool_id:
            print("Aborted; nothing was deleted.")
            return 1

    try:
        summary = clear_users(pool_id=pool_id, dry_run=args.dry_run, client=client)
    except (ClientError, BotoCoreError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    action = "Would delete" if summary["dry_run"] else "Deleted"
    print(f"{action} {summary['deleted']} account(s) from '{summary['user_pool_id']}'.")
    if not summary["dry_run"] and summary["still_listed"]:
        print(
            f"{summary['still_listed']} account(s) are still listed. "
            "Cognito finishes deletion in the background; they can no longer sign in."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
