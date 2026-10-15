"""Allow the `email` and `profile` OAuth scopes on a Cognito app client.

Arcus sign-in can only request scopes the app client allows; anything else
fails at the authorize endpoint with `invalid_scope`. `profile` puts every
attribute the client can read (including `custom:student_id`) into the ID
token. `openid` is kept, because Cognito only accepts `email` and `profile`
alongside it.

UpdateUserPoolClient replaces the whole client configuration: any field left
out of the request is reset to its default (callback URLs, OAuth flows, token
lifetimes, read/write attributes, and so on). This script therefore reads the
current client first and sends every updatable field back unchanged, with only
the merged scope list replaced.

Pool and client ids default to arcus-attendance's env names
(`COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`). Without `--dry-run` it asks for
confirmation unless `--yes` is passed.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

AWS_REGION = os.environ.get(
    "AWS_COGNITO_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)

REQUIRED_SCOPES = ("openid", "email", "profile")

# Every field UpdateUserPoolClient accepts besides the two ids. Fields that
# DescribeUserPoolClient returns but update rejects (ClientSecret,
# CreationDate, LastModifiedDate) are deliberately absent.
_UPDATABLE_FIELDS = (
    "ClientName",
    "RefreshTokenValidity",
    "AccessTokenValidity",
    "IdTokenValidity",
    "TokenValidityUnits",
    "ReadAttributes",
    "WriteAttributes",
    "ExplicitAuthFlows",
    "SupportedIdentityProviders",
    "CallbackURLs",
    "LogoutURLs",
    "DefaultRedirectURI",
    "AllowedOAuthFlows",
    "AllowedOAuthScopes",
    "AllowedOAuthFlowsUserPoolClient",
    "AnalyticsConfiguration",
    "PreventUserExistenceErrors",
    "EnableTokenRevocation",
    "EnablePropagateAdditionalUserContextData",
    "AuthSessionValidity",
    "RefreshTokenRotation",
)


def merged_scopes(current: list[str]) -> list[str]:
    """Current scopes plus any missing required ones, original order first."""
    scopes = list(current)
    for scope in REQUIRED_SCOPES:
        if scope not in scopes:
            scopes.append(scope)
    return scopes


def build_update_request(client: dict[str, Any], scopes: list[str]) -> dict[str, Any]:
    request: dict[str, Any] = {
        "UserPoolId": client["UserPoolId"],
        "ClientId": client["ClientId"],
    }
    for field in _UPDATABLE_FIELDS:
        if field in client:
            request[field] = client[field]
    request["AllowedOAuthScopes"] = scopes
    return request


def add_client_scopes(
    user_pool_id: str,
    client_id: str,
    *,
    dry_run: bool = False,
    yes: bool = False,
    cognito: Any = None,
) -> dict[str, Any]:
    cognito = cognito or boto3.client("cognito-idp", region_name=AWS_REGION)
    client = cognito.describe_user_pool_client(
        UserPoolId=user_pool_id, ClientId=client_id
    )["UserPoolClient"]

    current = list(client.get("AllowedOAuthScopes", []))
    scopes = merged_scopes(current)
    added = [scope for scope in scopes if scope not in current]
    summary = {
        "client_name": client.get("ClientName", ""),
        "client_id": client_id,
        "before": current,
        "after": scopes,
        "added": added,
        "applied": False,
    }

    print(f"App client: {summary['client_name']} ({client_id})")
    print(f"Current scopes: {', '.join(current) or '(none)'}")

    if not added:
        print("email and profile are already allowed. Nothing to change.")
        return summary

    print(f"Scopes to add:  {', '.join(added)}")
    print(f"New scopes:     {', '.join(scopes)}")

    if not client.get("AllowedOAuthFlowsUserPoolClient"):
        print(
            "Warning: this client has OAuth disabled "
            "(AllowedOAuthFlowsUserPoolClient is false), so hosted sign-in "
            "ignores its scopes."
        )

    if dry_run:
        print("Dry run: no changes made.")
        return summary

    if not yes:
        answer = input("Update this app client? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled. No changes made.")
            return summary

    cognito.update_user_pool_client(**build_update_request(client, scopes))
    summary["applied"] = True
    print("Updated. Sign out of Arcus and sign in again to get a token with the new scopes.")
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--user-pool-id",
        default=os.environ.get("COGNITO_USER_POOL_ID", ""),
        help="Cognito user pool id (default: COGNITO_USER_POOL_ID)",
    )
    parser.add_argument(
        "--client-id",
        default=os.environ.get("COGNITO_CLIENT_ID", ""),
        help="Cognito app client id (default: COGNITO_CLIENT_ID)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show the change without applying it")
    parser.add_argument("--yes", action="store_true", help="Apply without asking for confirmation")
    args = parser.parse_args(argv)

    user_pool_id = args.user_pool_id.strip()
    client_id = args.client_id.strip()
    if not user_pool_id or not client_id:
        parser.error("Provide --user-pool-id and --client-id, or set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.")

    try:
        add_client_scopes(user_pool_id, client_id, dry_run=args.dry_run, yes=args.yes)
    except (BotoCoreError, ClientError) as error:
        print(f"Cognito request failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
