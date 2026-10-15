"""Clone the managed login branding style from the arcus-apps app client.

Cognito links each managed login style to one app client and does not copy it
when the client itself is cloned. This script describes the source style and
creates it on another app client in the same user pool.

DescribeManagedLoginBrandingByClient is called with ReturnMergedResources so
the copy includes values the source still inherits from Cognito defaults. When
the source uses Cognito-provided values, the clone does too, and settings and
images are omitted. Otherwise the settings document and image assets are
copied. Identity-provider icons keep their resource id, which is the provider
name. Icons for providers that are not configured in the user pool are left
out. Cognito rejects those, and it also rejects a request that sends several
IdP icons with no provider name.

Create and update requests must stay under 2 MB. Settings go in the create
call. Image files that do not fit are sent in later UpdateManagedLoginBranding
calls, which leave unspecified settings in place.

The target client can have only one style. If it already has one, the script
stops unless --replace is set, in which case that style is deleted first. The
source style is not modified.

Pool id defaults to COGNITO_USER_POOL_ID, then AWS_COGNITO_USER_POOL_ID.
Without --dry-run the script asks for confirmation unless --yes is passed.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

AWS_REGION = os.environ.get(
    "AWS_COGNITO_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)

DEFAULT_SOURCE_NAME = "apex-attendance-system"

# Stay under the 2 MB request limit after image bytes are base64-encoded.
_MAX_REQUEST_BYTES = 1_800_000
_MAX_ASSET_BYTES = 1_000_000
_RESOURCE_ID = re.compile(r"^[\w\- ]{1,40}$")


class CloneError(Exception):
    """A clone that cannot proceed because a client or style is missing or already assigned."""


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


def resolve_client_id(
    cognito: Any,
    user_pool_id: str,
    *,
    name: str,
    client_id: str,
    role: str,
) -> str:
    client_id = client_id.strip()
    if client_id:
        return client_id
    matches = find_client_ids_by_name(cognito, user_pool_id, name)
    if not matches:
        raise CloneError(f"No {role} app client named {name!r} in pool {user_pool_id}.")
    if len(matches) > 1:
        listed = ", ".join(matches)
        raise CloneError(
            f"More than one {role} app client is named {name!r}: {listed}. "
            f"Pass --{role}-client-id."
        )
    return matches[0]


def _error_code(error: ClientError) -> str:
    return error.response.get("Error", {}).get("Code", "")


def require_app_client(cognito: Any, user_pool_id: str, client_id: str, role: str) -> dict[str, Any]:
    try:
        return cognito.describe_user_pool_client(UserPoolId=user_pool_id, ClientId=client_id)[
            "UserPoolClient"
        ]
    except ClientError as error:
        if _error_code(error) == "ResourceNotFoundException":
            raise CloneError(f"No {role} app client {client_id} in pool {user_pool_id}.") from error
        raise


def describe_branding(cognito: Any, user_pool_id: str, client_id: str) -> dict[str, Any] | None:
    try:
        return cognito.describe_managed_login_branding_by_client(
            UserPoolId=user_pool_id,
            ClientId=client_id,
            ReturnMergedResources=True,
        )["ManagedLoginBranding"]
    except ClientError as error:
        if _error_code(error) == "ResourceNotFoundException":
            return None
        raise


def _asset_label(asset: dict[str, Any]) -> str:
    label = f"{asset.get('Category', 'asset')} {asset.get('ColorMode', '')}".strip()
    resource_id = asset.get("ResourceId")
    if resource_id:
        return f"{label} {resource_id}"
    return label


def list_identity_provider_names(cognito: Any, user_pool_id: str) -> set[str]:
    """Provider names that can own an IDP_BUTTON_ICON, including the built-in one."""
    names = {"COGNITO"}
    token: str | None = None
    while True:
        kwargs: dict[str, Any] = {"UserPoolId": user_pool_id, "MaxResults": 60}
        if token:
            kwargs["NextToken"] = token
        page = cognito.list_identity_providers(**kwargs)
        for provider in page.get("Providers", []):
            name = provider.get("ProviderName")
            if name:
                names.add(name)
        token = page.get("NextToken")
        if not token:
            return names


def copy_assets(
    assets: list[dict[str, Any]] | None,
    *,
    identity_providers: set[str],
) -> tuple[list[dict[str, Any]], list[str]]:
    """Assets suitable for create or update.

    Identity-provider icons are kept distinct by ResourceId (the provider
    name). Icons whose provider is not in the user pool are skipped. Two
    assets with the same category, color mode, and resource id are the same
    slot; the first one is kept.
    """
    copied: list[dict[str, Any]] = []
    warnings: list[str] = []
    seen: set[tuple[str, str, str]] = set()
    for asset in assets or []:
        label = _asset_label(asset)
        raw = asset.get("Bytes")
        if not raw:
            warnings.append(f"Skipped {label}: Cognito returned no image bytes.")
            continue
        if not isinstance(raw, (bytes, bytearray)):
            warnings.append(f"Skipped {label}: image bytes were not binary.")
            continue
        if len(raw) > _MAX_ASSET_BYTES:
            raise CloneError(f"{label} is {len(raw)} bytes. Cognito allows at most {_MAX_ASSET_BYTES}.")
        for field in ("Category", "ColorMode", "Extension"):
            if not asset.get(field):
                raise CloneError(f"{label} is missing {field}.")
        cloned: dict[str, Any] = {
            "Category": asset["Category"],
            "ColorMode": asset["ColorMode"],
            "Extension": asset["Extension"],
            "Bytes": bytes(raw),
        }
        resource_id = asset.get("ResourceId") or ""
        if resource_id:
            if _RESOURCE_ID.fullmatch(resource_id) is None:
                raise CloneError(f"{label} has a resource id Cognito would reject: {resource_id!r}.")
            if cloned["Category"] == "IDP_BUTTON_ICON" and resource_id not in identity_providers:
                warnings.append(f"Skipped {label}: that identity provider is not in this user pool.")
                continue
            cloned["ResourceId"] = resource_id
        identity = (cloned["Category"], cloned["ColorMode"], resource_id)
        if identity in seen:
            warnings.append(f"Skipped duplicate {label}.")
            continue
        seen.add(identity)
        copied.append(cloned)
    return copied, warnings


def _encoded_asset_size(asset: dict[str, Any]) -> int:
    # JSON sends the blob as base64, which is about 4/3 of the raw file plus the keys.
    return ((len(asset["Bytes"]) + 2) // 3) * 4 + 180


def _settings_size(settings: Any) -> int:
    if settings is None:
        return 0
    return len(json.dumps(settings, default=str).encode("utf-8"))


def split_assets(
    assets: list[dict[str, Any]],
    *,
    settings_size: int,
) -> tuple[list[dict[str, Any]], list[list[dict[str, Any]]]]:
    """Assets for the create call, then batches for later updates."""
    if settings_size > _MAX_REQUEST_BYTES:
        raise CloneError(
            f"Branding settings are {settings_size} bytes and exceed the {_MAX_REQUEST_BYTES} byte request budget."
        )

    create_budget = _MAX_REQUEST_BYTES - settings_size
    create_assets: list[dict[str, Any]] = []
    create_size = 0
    remaining: list[dict[str, Any]] = []
    for asset in assets:
        size = _encoded_asset_size(asset)
        if size > _MAX_REQUEST_BYTES:
            label = f"{asset['Category']} {asset['ColorMode']}"
            raise CloneError(f"{label} does not fit in one branding request.")
        if create_size + size <= create_budget:
            create_assets.append(asset)
            create_size += size
        else:
            remaining.append(asset)

    updates: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_size = 0
    for asset in remaining:
        size = _encoded_asset_size(asset)
        if current and current_size + size > _MAX_REQUEST_BYTES:
            updates.append(current)
            current = []
            current_size = 0
        current.append(asset)
        current_size += size
    if current:
        updates.append(current)
    return create_assets, updates


def build_create_request(
    branding: dict[str, Any],
    *,
    user_pool_id: str,
    client_id: str,
    assets: list[dict[str, Any]],
) -> dict[str, Any]:
    if branding.get("UseCognitoProvidedValues"):
        return {
            "UserPoolId": user_pool_id,
            "ClientId": client_id,
            "UseCognitoProvidedValues": True,
        }
    request: dict[str, Any] = {
        "UserPoolId": user_pool_id,
        "ClientId": client_id,
        "UseCognitoProvidedValues": False,
    }
    if branding.get("Settings") is not None:
        request["Settings"] = branding["Settings"]
    if assets:
        request["Assets"] = assets
    return request


def _asset_lines(assets: list[dict[str, Any]]) -> str:
    if not assets:
        return "Assets: (none)"
    lines = "\n".join(
        "  {category} ({details}, {size} bytes)".format(
            category=asset["Category"],
            details=", ".join(
                part
                for part in (asset["ColorMode"], asset["Extension"], asset.get("ResourceId", ""))
                if part
            ),
            size=len(asset["Bytes"]),
        )
        for asset in assets
    )
    return f"Assets ({len(assets)}):\n{lines}"


def format_summary(
    source: dict[str, Any],
    target: dict[str, Any],
    branding: dict[str, Any],
    *,
    assets: list[dict[str, Any]],
    update_batches: list[list[dict[str, Any]]],
    warnings: list[str],
    replace: bool,
    target_branding_id: str,
) -> str:
    if branding.get("UseCognitoProvidedValues"):
        style = "Cognito-provided defaults"
        calls = "1 create request"
    else:
        style = "custom settings"
        calls = f"1 create request and {len(update_batches)} asset update(s)"
    lines = [
        f"Source: {source.get('ClientName', '')} ({source.get('ClientId', '')})",
        f"Source style: {branding.get('ManagedLoginBrandingId', '')}",
        f"Style kind: {style}",
        f"Target: {target.get('ClientName', '')} ({target.get('ClientId', '')})",
        _asset_lines(assets) if not branding.get("UseCognitoProvidedValues") else "Assets: omitted with Cognito defaults",
        f"API calls: {calls}",
        "The source style is not modified.",
    ]
    if target_branding_id and replace:
        lines.append(f"Replace: delete target style {target_branding_id}, then create the copy.")
    lines.extend(warnings)
    return "\n".join(lines)


def clone_managed_login_branding(
    user_pool_id: str,
    *,
    target_name: str = "",
    target_client_id: str = "",
    source_name: str = DEFAULT_SOURCE_NAME,
    source_client_id: str = "",
    replace: bool = False,
    dry_run: bool = False,
    yes: bool = False,
    cognito: Any = None,
) -> dict[str, Any]:
    cognito = cognito or boto3.client("cognito-idp", region_name=AWS_REGION)
    source_id = resolve_client_id(
        cognito,
        user_pool_id,
        name=source_name,
        client_id=source_client_id,
        role="source",
    )
    target_id = resolve_client_id(
        cognito,
        user_pool_id,
        name=target_name,
        client_id=target_client_id,
        role="target",
    )
    if source_id == target_id:
        raise CloneError("Source and target app clients are the same.")

    source = require_app_client(cognito, user_pool_id, source_id, "source")
    target = require_app_client(cognito, user_pool_id, target_id, "target")
    branding = describe_branding(cognito, user_pool_id, source_id)
    if branding is None:
        raise CloneError(
            f"{source.get('ClientName', source_id)} ({source_id}) has no managed login style."
        )
    target_branding = describe_branding(cognito, user_pool_id, target_id)
    target_branding_id = (target_branding or {}).get("ManagedLoginBrandingId", "")
    if target_branding_id and not replace:
        raise CloneError(
            f"{target.get('ClientName', target_id)} ({target_id}) already has managed login "
            f"style {target_branding_id}. Pass --replace to delete it and copy the source style."
        )

    use_defaults = bool(branding.get("UseCognitoProvidedValues"))
    assets: list[dict[str, Any]] = []
    warnings: list[str] = []
    update_batches: list[list[dict[str, Any]]] = []
    if not use_defaults:
        assets, warnings = copy_assets(
            branding.get("Assets"),
            identity_providers=list_identity_provider_names(cognito, user_pool_id),
        )
        settings_size = _settings_size(branding.get("Settings"))
        create_assets, update_batches = split_assets(assets, settings_size=settings_size)
    else:
        create_assets = []

    print(
        format_summary(
            source,
            target,
            branding,
            assets=assets,
            update_batches=update_batches,
            warnings=warnings,
            replace=replace,
            target_branding_id=target_branding_id,
        )
    )

    summary: dict[str, Any] = {
        "source_client_id": source_id,
        "target_client_id": target_id,
        "managed_login_branding_id": "",
        "applied": False,
    }
    if dry_run:
        print("Dry run: no style created.")
        return summary

    if not yes:
        answer = input("Copy this managed login style? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("Cancelled. No style created.")
            return summary

    if target_branding_id:
        cognito.delete_managed_login_branding(
            UserPoolId=user_pool_id,
            ManagedLoginBrandingId=target_branding_id,
        )

    created = cognito.create_managed_login_branding(
        **build_create_request(
            branding,
            user_pool_id=user_pool_id,
            client_id=target_id,
            assets=create_assets,
        )
    )["ManagedLoginBranding"]
    branding_id = created.get("ManagedLoginBrandingId", "")
    summary["managed_login_branding_id"] = branding_id

    try:
        for batch in update_batches:
            cognito.update_managed_login_branding(
                UserPoolId=user_pool_id,
                ManagedLoginBrandingId=branding_id,
                Assets=batch,
            )
    except (BotoCoreError, ClientError):
        print(
            f"Style {branding_id} was created on {target_id}, but a later asset update failed. "
            "Settings from the create request are already saved.",
            file=sys.stderr,
        )
        raise

    summary["applied"] = True
    print(f"Created managed login style: {branding_id}")
    print(f"Assigned to: {target.get('ClientName', '')} ({target_id})")
    return summary


def _default_user_pool_id() -> str:
    return os.environ.get("COGNITO_USER_POOL_ID", os.environ.get("AWS_COGNITO_USER_POOL_ID", ""))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--target-client-id",
        default="",
        help="App client that receives the style",
    )
    parser.add_argument(
        "--target-name",
        default="",
        help="App client name that receives the style. Used when --target-client-id is omitted.",
    )
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
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete the target's existing style before copying",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show the clone without creating it")
    parser.add_argument("--yes", action="store_true", help="Copy the style without asking")
    args = parser.parse_args(argv)

    user_pool_id = args.user_pool_id.strip()
    if not user_pool_id:
        parser.error(
            "Provide --user-pool-id, or set COGNITO_USER_POOL_ID or AWS_COGNITO_USER_POOL_ID."
        )
    if not args.target_client_id.strip() and not args.target_name.strip():
        parser.error("Provide --target-client-id or --target-name.")

    try:
        clone_managed_login_branding(
            user_pool_id,
            target_name=args.target_name,
            target_client_id=args.target_client_id,
            source_name=args.source_name,
            source_client_id=args.source_client_id,
            replace=args.replace,
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
