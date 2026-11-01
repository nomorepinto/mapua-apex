"""Delete only DynamoDB items a suite manifest can prove it created."""

from __future__ import annotations

import boto3

from config import Settings
from manifest import Manifest, load_manifests

KEY_ATTRS = [
    "PK",
    "SK",
    "GSI1PK",
    "GSI1SK",
    "GSI2PK",
    "GSI2SK",
    "GSI3PK",
    "GSI3SK",
    "GSI4PK",
    "GSI4SK",
    "GSI5PK",
    "GSI5SK",
    "GSI6PK",
    "GSI6SK",
]

MANAGED_GROUPS = ["dean", "org_adviser", "cdm_reviewer", "osaar", "org_submitter"]


def _cognito(settings: Settings):
    return boto3.client("cognito-idp", region_name=settings.cognito_region)


def snapshot_settings(settings: Settings, manifest: Manifest) -> None:
    table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.table_name)
    found = table.get_item(Key={"PK": "SETTINGS#APPROVAL", "SK": "SETTINGS#APPROVAL"}).get("Item")
    manifest.data["settings_snapshotted"] = True
    manifest.data["settings_existed"] = found is not None
    manifest.data["settings_item"] = found
    manifest.save()


def _tokens(manifests: list[Manifest]) -> list[str]:
    tokens: list[str] = []
    for manifest in manifests:
        for token in manifest.match_tokens:
            if token not in tokens:
                tokens.append(token)
    return tokens


def _protected(manifests: list[Manifest]) -> set[str]:
    protected = {"SETTINGS#APPROVAL"}
    for manifest in manifests:
        cdm = manifest.data.get("preexisting_cdm_id")
        if cdm:
            protected.add(f"SIGNATORY#{cdm}")
    return protected


def matching_items(settings: Settings, manifests: list[Manifest]) -> list[dict]:
    tokens = _tokens(manifests)
    if not tokens:
        return []
    protected = _protected(manifests)
    table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.table_name)
    found: list[dict] = []
    scan = table.scan()
    while True:
        for item in scan.get("Items", []):
            pk = str(item.get("PK", ""))
            if pk in protected:
                continue
            blob = " ".join(str(item.get(attr, "")) for attr in KEY_ATTRS)
            if any(token in blob for token in tokens):
                found.append(item)
        if "LastEvaluatedKey" not in scan:
            break
        scan = table.scan(ExclusiveStartKey=scan["LastEvaluatedKey"])
    return found


def delete_items(settings: Settings, items: list[dict], *, dry_run: bool, cap: int, force: bool) -> int:
    if len(items) > cap and not force:
        raise RuntimeError(f"Refusing to delete {len(items)} items, which is above the cap of {cap}.")
    if dry_run:
        for item in items:
            print(f"DRY RUN delete {item.get('PK')} {item.get('SK')}")
        return 0
    table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.table_name)
    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
    return len(items)


def restore_settings(settings: Settings, manifest: Manifest) -> None:
    if not manifest.data.get("settings_snapshotted"):
        return
    table = boto3.resource("dynamodb", region_name=settings.aws_region).Table(settings.table_name)
    if manifest.data.get("settings_existed") and manifest.data.get("settings_item"):
        table.put_item(Item=manifest.data["settings_item"])
        return
    if not manifest.data.get("settings_existed"):
        table.delete_item(Key={"PK": "SETTINGS#APPROVAL", "SK": "SETTINGS#APPROVAL"})


def clear_student_attributes(settings: Settings, usernames: list[str]) -> None:
    if not usernames or not settings.cognito_pool_id:
        return
    client = _cognito(settings)
    for username in usernames:
        try:
            client.admin_delete_user_attributes(
                UserPoolId=settings.cognito_pool_id,
                Username=username,
                UserAttributeNames=["custom:student_id"],
            )
        except client.exceptions.UserNotFoundException:
            continue


def release_test_groups(settings: Settings, usernames: list[str]) -> None:
    """Drop managed groups and link attributes. Does not delete the user."""
    if not usernames or not settings.cognito_pool_id:
        return
    client = _cognito(settings)
    for username in usernames:
        try:
            client.admin_delete_user_attributes(
                UserPoolId=settings.cognito_pool_id,
                Username=username,
                UserAttributeNames=["custom:signatory_id", "custom:organization_id", "custom:student_id"],
            )
        except client.exceptions.UserNotFoundException:
            continue
        for group in MANAGED_GROUPS:
            try:
                client.admin_remove_user_from_group(
                    UserPoolId=settings.cognito_pool_id,
                    Username=username,
                    GroupName=group,
                )
            except Exception:
                continue


def cleanup_manifests(
    settings: Settings,
    manifests: list[Manifest],
    *,
    dry_run: bool = False,
    force: bool = False,
    restore: Manifest | None = None,
) -> tuple[int, int]:
    items = matching_items(settings, manifests)
    deleted = delete_items(settings, items, dry_run=dry_run, cap=settings.deletion_cap, force=force)
    if restore and not dry_run:
        restore_settings(settings, restore)
    leftovers = 0 if dry_run else len(matching_items(settings, manifests))
    if leftovers == 0 and not dry_run:
        for manifest in manifests:
            if manifest.path.is_file() and manifest.path.name.startswith("manifest-"):
                # Keep the current run's manifest until the caller says so.
                pass
    return deleted, leftovers


def leftover_count(settings: Settings, manifests: list[Manifest]) -> int:
    return len(matching_items(settings, manifests))


def all_state_manifests(state_dir) -> list[Manifest]:
    return load_manifests(state_dir)
