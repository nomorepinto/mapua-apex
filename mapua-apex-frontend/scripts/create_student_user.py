"""Provision student-org Cognito accounts (org_submitter).

Creates users with `name`, `email`, and `custom:organization_id`, then adds
them to the `org_submitter` group. The caller passes an organization *name*;
the matching organization_id is resolved from `organizations.py`.

`create_student_account` accepts one dict or a list of dicts.

Example:

    from create_student_user import create_student_account

    create_student_account({
        "name": "Jane Doe",
        "email": "jane@mapua.edu.ph",
        "organization name": "MGC",
    })

    create_student_account([
        {"name": "Jane Doe", "email": "jane@mapua.edu.ph", "organization name": "MGC"},
        {"name": "John Cruz", "email": "john@mapua.edu.ph", "organization name": "Organization X"},
    ])
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import boto3
from botocore.exceptions import ClientError

from organizations import ORGANIZATIONS

USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "ap-southeast-1_8n74mhAnM")
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1"))
STUDENT_GROUP = "org_submitter"

_ORG_NAME_KEYS = ("organization name", "organization_name", "organization")


def resolve_organization_id(organization_name: str) -> str:
    """Return the organization_id for a name in `ORGANIZATIONS`."""
    name = organization_name.strip()
    if not name:
        raise ValueError("Organization name is required.")

    if name in ORGANIZATIONS:
        return ORGANIZATIONS[name]

    by_lower = {key.lower(): value for key, value in ORGANIZATIONS.items()}
    organization_id = by_lower.get(name.lower())
    if organization_id:
        return organization_id

    known = ", ".join(sorted(ORGANIZATIONS))
    raise KeyError(f"Unknown organization {name!r}. Known organizations: {known}")


def _required_field(account: dict[str, Any], key: str) -> str:
    value = account.get(key)
    if value is None:
        raise ValueError(f"Missing required field: {key}")
    text = str(value).strip()
    if not text:
        raise ValueError(f"Missing required field: {key}")
    return text


def _organization_name(account: dict[str, Any]) -> str:
    for key in _ORG_NAME_KEYS:
        value = account.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    raise ValueError("Missing required field: organization name")


def _cognito_client():
    return boto3.client("cognito-idp", region_name=AWS_REGION)


def _create_one_student(account: dict[str, Any], client) -> dict[str, Any]:
    name = _required_field(account, "name")
    email = _required_field(account, "email")
    organization_id = resolve_organization_id(_organization_name(account))

    try:
        response = client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "name", "Value": name},
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:organization_id", "Value": organization_id},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except ClientError as error:
        raise RuntimeError(
            f"Failed to create student account for {email}: {error.response['Error']['Message']}"
        ) from error

    try:
        client.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=email,
            GroupName=STUDENT_GROUP,
        )
    except ClientError as error:
        raise RuntimeError(
            f"Created {email} but failed to add to {STUDENT_GROUP}: "
            f"{error.response['Error']['Message']}"
        ) from error

    user = response.get("User", {})
    return {
        "username": user.get("Username", email),
        "email": email,
        "name": name,
        "organization_id": organization_id,
        "group": STUDENT_GROUP,
        "user_status": user.get("UserStatus"),
        "user": user,
    }


def _account_error(account: Any, error: Exception) -> dict[str, Any]:
    payload = account if isinstance(account, dict) else {}
    return {
        "email": payload.get("email"),
        "name": payload.get("name"),
        "error": str(error),
    }


def create_student_account(
    accounts: dict[str, Any] | list[dict[str, Any]],
) -> dict[str, Any] | list[dict[str, Any]]:
    """Create student Cognito user(s) from name, email, and organization name.

    Args:
        accounts: One dict, or a list of dicts, each with `name`, `email`,
            and `organization name`.

    Returns:
        One result dict for a single account. A list of result dicts for a
        batch. Failed batch items include an `error` key instead of raising.
    """
    client = _cognito_client()

    if isinstance(accounts, dict):
        return _create_one_student(accounts, client)

    if not isinstance(accounts, list):
        raise TypeError("accounts must be a dict or a list of dicts")
    if not accounts:
        raise ValueError("accounts list is empty")

    results: list[dict[str, Any]] = []
    for index, account in enumerate(accounts):
        if not isinstance(account, dict):
            results.append(
                _account_error(
                    account,
                    TypeError(f"Item {index} must be a dict, got {type(account).__name__}"),
                )
            )
            continue
        try:
            results.append(_create_one_student(account, client))
        except (KeyError, ValueError, RuntimeError) as error:
            results.append(_account_error(account, error))
    return results


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a student-org Cognito account (org_submitter)."
    )
    parser.add_argument("--name", required=True, help="Display name stored on the Cognito user")
    parser.add_argument("--email", required=True, help="Sign-in email (Cognito username)")
    parser.add_argument(
        "--organization",
        required=True,
        help="Organization name looked up in organizations.py",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    created = create_student_account(
        {
            "name": args.name,
            "email": args.email,
            "organization name": args.organization,
        }
    )
    print(
        f"Created student account {created['email']} "
        f"(organization_id={created['organization_id']}, group={created['group']}, "
        f"status={created['user_status']})"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (KeyError, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
