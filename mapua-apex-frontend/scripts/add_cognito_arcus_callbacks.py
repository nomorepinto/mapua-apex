"""Add an OAuth callback and logout URL to a Cognito app client.

Arcus sign-in goes through the Cognito hosted UI. The hosted UI rejects the
authorize request with `redirect_mismatch` when the app's `redirect_uri` is
not one of the client's `CallbackURLs`, and the sign-out redirect fails the
same way against `LogoutURLs`. This is what breaks the local e2e run when
the app base URL (e.g. `http://localhost:3001`) does not match the callback
that is registered (e.g. `http://localhost:3000/api/auth/callback`).

UpdateUserPoolClient replaces the whole client configuration: any field left
out of the request is reset to its default. This script therefore reads the
current client first and sends every updatable field back unchanged, with
only the merged callback / logout URL lists (and, if requested, the default
redirect) replaced.

Existing URLs are preserved; missing URLs are appended, so it is safe to run
repeatedly. Without `--dry-run` it asks for confirmation unless `--yes` is
passed.
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


def merge_urls(current: list[str], additions: list[str]) -> list[str]:
    """Current URLs first, additions appended, no duplicates."""
    merged = list(current)
    for url in additions:
        if url and url not in merged:
            merged.append(url)
    return merged


def build_update_request(
    client: dict[str, Any],
    callbacks: list[str],
    logouts: list[str],
    default_redirect: str | None,
) -> dict[str, Any]:
    request: dict[str, Any] = {
        "UserPoolId": client["UserPoolId"],
        "ClientId": client["ClientId"],
    }
    for field in _UPDATABLE_FIELDS:
        if field in client:
            request[field] = client[field]
    request["CallbackURLs"] = callbacks
    request["LogoutURLs"] = logouts
    if default_redirect:
        # Keep default redirect inside the allowed callback list.
        request["DefaultRedirectURI"] = default_redirect
    return request


def add_client_urls(
    user_pool_id: str,
    client_id: str,
    *,
    callback: str,
    logout: str,
    set_default_redirect: bool,
    dry_run: bool = False,
    yes: bool = False,
    cognito: Any = None,
) -> dict[str, Any]:
    cognito = cognito or boto3.client("cognito-idp", region_name=AWS_REGION)
    client = cognito.describe_user_pool_client(
        UserPoolId=user_pool_id, ClientId=client_id
    )["UserPoolClient"]

    current_callbacks = list(client.get("CallbackURLs", []))
    current_logouts = list(client.get("LogoutURLs", []))
    new_callbacks = merge_urls(current_callbacks, [callback])
    new_logouts = merge_urls(current_logouts, [logout])
    added_callbacks = [url for url in new_callbacks if url not in current_callbacks]
    added_logouts = [url for url in new_logouts if url not in current_logouts]

    default_redirect = client.get("DefaultRedirectURI", "")
    new_default = default_redirect
    if set_default_redirect and callback and callback != default_redirect:
        new_default = callback

    summary = {
        "client_name": client.get("ClientName", ""),
        "client_id": client_id,
        "before_callbacks": current_callbacks,
        "after_callbacks": new_callbacks,
        "added_callbacks": added_callbacks,
        "before_logouts": current_logouts,
        "after_logouts": new_logouts,
        "added_logouts": added_logouts,
        "before_default": default_redirect,
        "after_default": new_default,
        "applied": False,
    }

    print(f"App client: {summary['client_name']} ({client_id})")
    print(f"Current CallbackURLs: {', '.join(current_callbacks) or '(none)'}")
    print(f"Current LogoutURLs:   {', '.join(current_logouts) or '(none)'}")
    print(f"Current DefaultRedirectURI: {default_redirect or '(none)'}")

    changed = bool(added_callbacks or added_logouts or new_default != default_redirect)
    if not changed:
        print("Desired URLs are already registered. Nothing to change.")
        return summary

    if added_callbacks:
        print(f"Callbacks to add: {', '.join(added_callbacks)}")
    if added_logouts:
        print(f"Logouts to add:   {', '.join(added_logouts)}")
    if new_default != default_redirect:
        print(f"Default redirect: {default_redirect or '(none)'} -> {new_default}")

    if not client.get("AllowedOAuthFlowsUserPoolClient"):
        print(
            "Warning: this client has OAuth disabled "
            "(AllowedOAuthFlowsUserPoolClient is false), so the hosted UI "
            "ignores its callback / logout URLs."
        )

    if dry_run:
        print("Dry run: no changes made.")
        return summary

    if not yes:
        answer = input("Update this app client? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled. No changes made.")
            return summary

    cognito.update_user_pool_client(
        **build_update_request(client, new_callbacks, new_logouts, new_default or None)
    )
    summary["applied"] = True
    print("Updated. The hosted UI will accept the new callback on the next sign-in attempt.")
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
    parser.add_argument(
        "--callback",
        required=True,
        help="Callback URL to add, e.g. http://localhost:3001/api/auth/callback",
    )
    parser.add_argument(
        "--logout",
        required=True,
        help="Logout URL to add, e.g. http://localhost:3001/",
    )
    parser.add_argument(
        "--set-default-redirect",
        action="store_true",
        help="Also set DefaultRedirectURI to the callback (only if it is not already)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show the change without applying it")
    parser.add_argument("--yes", action="store_true", help="Apply without asking for confirmation")
    args = parser.parse_args(argv)

    user_pool_id = args.user_pool_id.strip()
    client_id = args.client_id.strip()
    if not user_pool_id or not client_id:
        parser.error(
            "Provide --user-pool-id and --client-id, or set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID."
        )

    try:
        add_client_urls(
            user_pool_id,
            client_id,
            callback=args.callback.strip(),
            logout=args.logout.strip(),
            set_default_redirect=args.set_default_redirect,
            dry_run=args.dry_run,
            yes=args.yes,
        )
    except (BotoCoreError, ClientError) as error:
        print(f"Cognito request failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
