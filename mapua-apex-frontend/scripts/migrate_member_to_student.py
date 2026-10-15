"""One-time migration for the arcus-attendance MEMBER -> STUDENT rename.

Run this AFTER the arcus + apex code is deployed, so every new write already
uses the new key prefixes. It performs two independent passes over the shared
`mapua-apex` table (see `DynamoDB Schema.txt`):

1. Rename the arcus student **profile** items. arcus-attendance used to store a
   profile at `PK = SK = MEMBER#<studentId>`; the new code reads it at
   `PK = SK = STUDENT#<studentId>`. For each old profile this copies every
   attribute onto a new `STUDENT#<studentId>` item (dropping the deprecated
   `current_organization` / `registration_version` fields the new shape no
   longer carries) and then deletes the old `MEMBER#` item. The write is
   guarded by `attribute_not_exists(PK)`, so a re-run is a safe no-op for
   profiles that were already migrated.

       old:  PK = SK = MEMBER#<studentId>   ->   new: PK = SK = STUDENT#<studentId>

2. Delete the deprecated arcus-written ORGANIZATION + MEMBER **join rows**.
   Registration used to write its own membership rows at
   `PK = ORGANIZATION#<uuid>`, `SK = MEMBER#<studentId>` carrying
   `organization_id` + `student_id` and no names. Membership is now apex-owned
   (the ORGANIZATION_MEMBER roster, which has `lastname` / `firstname` /
   `student_number` and no `organization_id`), so those legacy rows are removed.
   The filter is deliberately narrow so it can never match an apex roster row.

The EVENT check-in rows (`PK = EVENT#<id>`, `SK = MEMBER#<studentId>`) are
NEVER touched: apex still identifies attendance children by the `MEMBER#` sort
key prefix, so that prefix stays.

`migrate_members_to_students` is importable and returns a summary dict. Running
the module executes a CLI. The operation is destructive; without `--dry-run` it
asks for confirmation unless `--yes` is passed.

Example:

    from migrate_member_to_student import migrate_members_to_students

    summary = migrate_members_to_students(dry_run=True)   # preview
    summary = migrate_members_to_students(yes=True)       # apply
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any, Iterator

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import BotoCoreError, ClientError

TABLE_NAME = os.environ.get("AWS_DYNAMODB_TABLE", os.environ.get("DYNAMODB_TABLE", "mapua-apex"))
AWS_REGION = os.environ.get(
    "AWS_DYNAMODB_REGION",
    os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-southeast-1")),
)
# Optional custom endpoint (e.g. a local DynamoDB) mirrors config/aws.php.
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT", os.environ.get("AWS_ENDPOINT"))

MEMBER_PREFIX = "MEMBER#"
STUDENT_PREFIX = "STUDENT#"
ORGANIZATION_PREFIX = "ORGANIZATION#"

# Old arcus profile attributes the new Student shape no longer carries.
_DROPPED_ATTRS = frozenset({"current_organization", "registration_version"})

# A legacy arcus profile: PK begins with MEMBER# and the item is its own sort key
# (PK = SK). Only the arcus profile partition uses the MEMBER# prefix on the PK,
# so this never matches ORGANIZATION# join rows or EVENT# check-in rows.
_PROFILE_FILTER = "#pk begins_with :memberPrefix AND #pk = #sk"
_PROFILE_NAMES = {"#pk": "PK", "#sk": "SK"}
_PROFILE_VALUES = {":memberPrefix": MEMBER_PREFIX}

# A legacy arcus-written membership join row: it lives under an ORGANIZATION#
# partition with a MEMBER# sort key and carries organization_id + student_id but
# NO names. An apex ORGANIZATION_MEMBER roster row has lastname/firstname and no
# organization_id, so it can never satisfy this filter.
_JOIN_ROW_FILTER = (
    Attr("PK").begins_with(ORGANIZATION_PREFIX)
    & Attr("SK").begins_with(MEMBER_PREFIX)
    & Attr("organization_id").exists()
    & Attr("student_id").exists()
    & Attr("lastname").not_exists()
    & Attr("firstname").not_exists()
)


def _table(resource_or_none=None, table_name: str = TABLE_NAME):
    resource = resource_or_none or boto3.resource("dynamodb", region_name=AWS_REGION, endpoint_url=DYNAMODB_ENDPOINT)
    return resource.Table(table_name)


def _paginate(method, kwargs: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Yield items from a paginated Scan/Query, carrying ExclusiveStartKey forward."""
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


def _scan(table, kwargs: dict[str, Any]) -> list[dict[str, Any]]:
    """Materialize a full scan so deletes never mutate the table mid-pagination."""
    return list(_paginate(table.scan, kwargs))


def _student_id_from_member_key(key: str) -> str:
    return key[len(MEMBER_PREFIX):] if key.startswith(MEMBER_PREFIX) else key


def _migrate_profiles(table, stats: dict[str, int], dry_run: bool) -> None:
    """Copy each MEMBER# profile onto a STUDENT# item, then delete the original."""
    profiles = _scan(
        table,
        {
            "FilterExpression": _PROFILE_FILTER,
            "ExpressionAttributeNames": _PROFILE_NAMES,
            "ExpressionAttributeValues": _PROFILE_VALUES,
            "ConsistentRead": True,
        },
    )

    for item in profiles:
        old_pk = item.get("PK", "")
        old_sk = item.get("SK", old_pk)
        student_id = _student_id_from_member_key(old_pk)
        stats["profiles_found"] += 1
        if not student_id:
            stats["profiles_skipped_invalid"] += 1
            continue

        new_key = STUDENT_PREFIX + student_id
        new_item = {key: value for key, value in item.items() if key not in _DROPPED_ATTRS}
        new_item["PK"] = new_key
        new_item["SK"] = new_key

        if dry_run:
            stats["profiles_written"] += 1
            stats["profiles_deleted"] += 1
            continue

        try:
            table.put_item(Item=new_item, ConditionExpression="attribute_not_exists(PK)")
            stats["profiles_written"] += 1
        except ClientError as error:
            # Already migrated by a previous run: keep the existing STUDENT item.
            if error.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                stats["profiles_skipped_existing"] += 1
            else:
                raise

        table.delete_item(Key={"PK": old_pk, "SK": old_sk})
        stats["profiles_deleted"] += 1


def _delete_join_rows(table, stats: dict[str, int], dry_run: bool) -> None:
    """Delete the deprecated arcus-written ORGANIZATION + MEMBER join rows."""
    rows = _scan(table, {"FilterExpression": _JOIN_ROW_FILTER, "ConsistentRead": True})

    for row in rows:
        stats["join_rows_found"] += 1
        if dry_run:
            stats["join_rows_deleted"] += 1
            continue
        table.delete_item(Key={"PK": row["PK"], "SK": row["SK"]})
        stats["join_rows_deleted"] += 1


def migrate_members_to_students(
    dry_run: bool = False,
    table=None,
) -> dict[str, Any]:
    """Migrate arcus MEMBER profiles to STUDENT and drop legacy join rows.

    Args:
        dry_run: Count what would change without writing or deleting anything.
        table: An optional pre-built `boto3` Table; created from the module
            config when not supplied.

    Returns:
        A summary dict with the table name, mode, and per-step totals under
        `counts`.
    """
    table = table or _table()

    stats = {
        "profiles_found": 0,
        "profiles_written": 0,
        "profiles_skipped_existing": 0,
        "profiles_skipped_invalid": 0,
        "profiles_deleted": 0,
        "join_rows_found": 0,
        "join_rows_deleted": 0,
    }

    _migrate_profiles(table, stats, dry_run)
    _delete_join_rows(table, stats, dry_run)

    return {"table": table.name, "dry_run": dry_run, "counts": stats}


def _format_summary(summary: dict[str, Any]) -> str:
    action = "Would migrate" if summary["dry_run"] else "Migrated"
    counts = summary["counts"]
    profile_bits = [f"{counts['profiles_written']} written"]
    if counts["profiles_skipped_existing"]:
        profile_bits.append(f"{counts['profiles_skipped_existing']} already existed")
    if counts["profiles_skipped_invalid"]:
        profile_bits.append(f"{counts['profiles_skipped_invalid']} skipped (bad key)")
    profile_bits.append(f"{counts['profiles_deleted']} old deleted")
    return (
        f"{action} in '{summary['table']}': "
        f"{counts['profiles_found']} MEMBER# profile(s) -> STUDENT# ({', '.join(profile_bits)}); "
        f"{counts['join_rows_found']} deprecated ORGANIZATION+MEMBER join row(s) "
        f"({counts['join_rows_deleted']} deleted)."
    )


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Rename arcus MEMBER# profile items to STUDENT# and delete the deprecated ORGANIZATION+MEMBER join rows.",
    )
    parser.add_argument("--table", default=TABLE_NAME, help=f"DynamoDB table name (default: {TABLE_NAME}).")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change; write and delete nothing.")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt (required for non-interactive use).")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    table = _table(table_name=args.table)

    if not args.dry_run and not args.yes:
        answer = input(
            f"This will rename MEMBER# profiles to STUDENT# and delete legacy join rows in '{table.name}'. "
            "It should be run AFTER the new code is deployed. Type 'yes' to confirm: "
        ).strip().lower()
        if answer != "yes":
            print("Aborted; nothing was changed.")
            return 1

    try:
        summary = migrate_members_to_students(dry_run=args.dry_run, table=table)
    except (ClientError, BotoCoreError) as error:
        print(f"error: DynamoDB operation failed: {error}", file=sys.stderr)
        return 1

    print(_format_summary(summary))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
