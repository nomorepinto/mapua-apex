"""Unlock a locked Cognito user account.

Cognito User Pools locks an account for 15-30 minutes after multiple failed
sign-in attempts. Calling `admin_set_user_password` with `Permanent=True`
clears the lockout state immediately and resets the password.

Usage:
    python scripts/unlock_cognito_user.py --username <email_or_username> --password <new_password>
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def load_root_env() -> None:
    """Load AWS credentials and pool config from root .env if not in environment."""
    env_file = Path(__file__).resolve().parents[2] / ".env"
    if not env_file.exists():
        return

    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key not in os.environ and val:
                os.environ[key] = val


def unlock_cognito_user(username: str, password: str | None = None) -> None:
    load_root_env()

    pool_id = os.environ.get("AWS_COGNITO_USER_POOL_ID", "ap-southeast-1_8n74mhAnM")
    region = os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")

    client = boto3.client("cognito-idp", region_name=region)

    print(f"Finding user '{username}' in user pool {pool_id}...")
    try:
        user_info = client.admin_get_user(UserPoolId=pool_id, Username=username)
        actual_username = user_info["Username"]
        status = user_info.get("UserStatus")
        enabled = user_info.get("Enabled")
        print(f"User found: Username={actual_username}, Status={status}, Enabled={enabled}")
    except ClientError as err:
        print(f"Error finding user: {err.response['Error']['Message']}")
        sys.exit(1)

    if password:
        print(f"Setting permanent password for '{actual_username}' to clear lockout...")
        try:
            client.admin_set_user_password(
                UserPoolId=pool_id,
                Username=actual_username,
                Password=password,
                Permanent=True,
            )
            print("Successfully set password and cleared lockout state!")
        except ClientError as err:
            print(f"Error setting password: {err.response['Error']['Message']}")
            sys.exit(1)
    else:
        print(f"Resetting password state for '{actual_username}'...")
        try:
            client.admin_reset_user_password(
                UserPoolId=pool_id,
                Username=actual_username,
            )
            print("Sent password reset code to user's verified contact.")
        except ClientError as err:
            print(f"Error resetting password: {err.response['Error']['Message']}")
            sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Unlock a locked Cognito user.")
    parser.add_argument(
        "--username",
        "-u",
        required=True,
        help="Cognito username or email address.",
    )
    parser.add_argument(
        "--password",
        "-p",
        help="New permanent password to set (clears failed-attempt counter and lockout immediately).",
    )
    args = parser.parse_args()

    unlock_cognito_user(username=args.username, password=args.password)


if __name__ == "__main__":
    main()

