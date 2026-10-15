"""Clone the Cognito app client named arcus-apps.

Cognito has no clone operation. This script describes that client and creates
a new one with the same settings: OAuth flows and scopes, callback and logout
URLs, token lifetimes, readable and writable attributes, auth flows, and the
other fields CreateUserPoolClient accepts.

The clone gets a new client id. When the source has a client secret, the clone
generates a new secret. Cognito returns that secret only in the create
response, so the script prints it once. The source client is left unchanged.

Managed login branding is a separate resource and is not copied. After this
client exists, copy the style with clone_managed_login_branding.py.

Pool id defaults to COGNITO_USER_POOL_ID, then AWS_COGNITO_USER_POOL_ID.
Without --dry-run the script asks for confirmation unless --yes is passed.
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

DEFAULT_SOURCE_NAME = "arcus-apps"

# Every field CreateUserPoolClient accepts besides UserPoolId, ClientName, and
# GenerateSecret. DescribeUserPoolClient also returns ClientId, ClientSecret,
# CreationDate, and LastModifiedDate; those are not sent back.
_CREATE_FIELDS = (
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


class CloneError(Exception):
    """A clone that cannot proceed because the source client is missing or ambiguous."""


def build_create_request(source: dict[str, Any], *, user_pool_id: str, client_name: str) -> dict[str, Any]:
    """CreateUserPoolClient input copied from a DescribeUserPoolClient result."""
    request: dict[str, Any] = {
        "UserPoolId": user_pool_id,
        "ClientName": client_name,
        "GenerateSecret": bool(source.get("ClientSecret")),
    }
    for field in _CREATE_FIELDS:
        if field not in source or source[field] is None:
            continue
        value = source[field]
        if value == "" or value == [] or value == {}:
            continue
        request[field] = value
    return request


def find_client_ids_by_name(cognito: Any, user_pool_id: str, name: str) -> list[str]:
    matches: list[str] = []
    token: str | None = None
    while True:
        kwargs: dict[str, Any] = {"UserPoolId": user_pool_id, "MaxResults": 60}
        if token:
            kwargs["NextToken"] = token
        page = cognito.list_user_pool_clients(**kwargs)
        for client in page.get("UserPoolClients", []):
            if client.get("ClientName") == name:
                matches.append(client["ClientId"])
        token = page.get("NextToken")
        if not token:
            return matches


def resolve_source_client(
    cognito: Any,
    user_pool_id: str,
    *,
    source_name: str,
    source_client_id: str,
) -> dict[str, Any]:
    client_id = source_client_id.strip()
    if not client_id:
        matches = find_client_ids_by_name(cognito, user_pool_id, source_name)
        if not matches:
            raise CloneError(f"No app client named {source_name!r} in pool {user_pool_id}.")
        if len(matches) > 1:
            listed = ", ".join(matches)
            raise CloneError(
                f"More than one app client is named {source_name!r}: {listed}. "
                "Pass --source-client-id."
            )
        client_id = matches[0]
    return cognito.describe_user_pool_client(UserPoolId=user_pool_id, ClientId=client_id)["UserPoolClient"]


def _format_list(label: str, values: list[str] | None) -> str:
    if not values:
        return f"{label}: (none)"
    lines = "\n".join(f"  {value}" for value in values)
    return f"{label}:\n{lines}"


def format_summary(source: dict[str, Any], request: dict[str, Any]) -> str:
    secret = (
        "a new client secret will be generated"
        if request["GenerateSecret"]
        else "public client, no secret"
    )
    return "\n".join(
        [
            f"Source: {source.get('ClientName', '')} ({source.get('ClientId', '')})",
            f"New client name: {request['ClientName']}",
            f"Secret: {secret}",
            _format_list("OAuth flows", request.get("AllowedOAuthFlows")),
            _format_list("OAuth scopes", request.get("AllowedOAuthScopes")),
            _format_list("Callback URLs", request.get("CallbackURLs")),
            _format_list("Logout URLs", request.get("LogoutURLs")),
            _format_list("Read attributes", request.get("ReadAttributes")),
            _format_list("Write attributes", request.get("WriteAttributes")),
            f"OAuth enabled: {bool(request.get('AllowedOAuthFlowsUserPoolClient'))}",
            "The source client is not modified.",
        ]
    )


def clone_app_client(
    user_pool_id: str,
    client_name: str,
    *,
    source_name: str = DEFAULT_SOURCE_NAME,
    source_client_id: str = "",
    dry_run: bool = False,
    yes: bool = False,
    cognito: Any = None,
) -> dict[str, Any]:
    client_name = client_name.strip()
    if not client_name:
        raise CloneError("Pass a non-empty --name for the new app client.")

    cognito = cognito or boto3.client("cognito-idp", region_name=AWS_REGION)
    source = resolve_source_client(
        cognito,
        user_pool_id,
        source_name=source_name,
        source_client_id=source_client_id,
    )
    request = build_create_request(source, user_pool_id=user_pool_id, client_name=client_name)
    print(format_summary(source, request))

    summary: dict[str, Any] = {
        "source_client_id": source.get("ClientId", ""),
        "source_client_name": source.get("ClientName", ""),
        "client_name": client_name,
        "client_id": "",
        "client_secret": "",
        "applied": False,
    }

    if dry_run:
        print("Dry run: no client created.")
        return summary

    if not yes:
        answer = input("Create this app client? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled. No client created.")
            return summary

    created = cognito.create_user_pool_client(**request)["UserPoolClient"]
    summary["client_id"] = created.get("ClientId", "")
    summary["client_secret"] = created.get("ClientSecret", "")
    summary["applied"] = True

    print(f"Created app client: {created.get('ClientName', client_name)}")
    print(f"Client id: {summary['client_id']}")
    if summary["client_secret"]:
        print(f"Client secret: {summary['client_secret']}")
        print("Store this secret now. It is not printed again.")
    print(
        "Managed login branding was not copied. Copy it with "
        "clone_managed_login_branding.py --target-client-id "
        f"{summary['client_id']}"
    )
    return summary


def _default_user_pool_id() -> str:
    return os.environ.get("COGNITO_USER_POOL_ID", os.environ.get("AWS_COGNITO_USER_POOL_ID", ""))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--name", required=True, help="Name for the new app client")
    parser.add_argument(
        "--user-pool-id",
        default=_default_user_pool_id(),
        help="Cognito user pool id (default: COGNITO_USER_POOL_ID or AWS_COGNITO_USER_POOL_ID)",
    )
    parser.add_argument(
        "--source-name",
        default=DEFAULT_SOURCE_NAME,
        help=f"Source app client name (default: {DEFAULT_SOURCE_NAME})",
    )
    parser.add_argument(
        "--source-client-id",
        default="",
        help="Source app client id. Use this when more than one client shares the source name.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show the clone without creating it")
    parser.add_argument("--yes", action="store_true", help="Create the client without asking")
    args = parser.parse_args(argv)

    user_pool_id = args.user_pool_id.strip()
    if not user_pool_id:
        parser.error(
            "Provide --user-pool-id, or set COGNITO_USER_POOL_ID or AWS_COGNITO_USER_POOL_ID."
        )

    try:
        clone_app_client(
            user_pool_id,
            args.name,
            source_name=args.source_name,
            source_client_id=args.source_client_id,
            dry_run=args.dry_run,
            yes=args.yes,
        )
    except CloneError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (BotoCoreError, ClientError) as error:
        print(f"Cognito request failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
