"""Recover sparse report timestamps from explicit, reliably linked evidence.

Dry-run is the default. Review its counts and obtain separate approval before
adding --apply. Run only after deploying the timestamp-preserving writer.
No event creation, latest submission, or user-entered timestamp is substituted.
No evidence means no update. Retained logs cannot reconstruct deleted history.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from typing import Any, Iterator


def timestamp(value: Any) -> str | None:
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed > datetime.now(timezone.utc):
            return None
        return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except ValueError:
        return None


def bare(value: Any, prefix: str) -> str:
    return value.removeprefix(prefix) if isinstance(value, str) else ""


def pages(method, **kwargs) -> Iterator[dict[str, Any]]:
    while True:
        result = method(**kwargs)
        yield from result.get("Items", [])
        continuation = result.get("LastEvaluatedKey")
        if not continuation:
            return
        kwargs["ExclusiveStartKey"] = continuation


def creation_evidence(log: dict[str, Any]) -> tuple[tuple[str, str], str] | None:
    if log.get("actionType") != "SUBMISSION_CREATE" or log.get("module") != "SUBMISSION":
        return None
    after = log.get("after") if isinstance(log.get("after"), dict) else {}
    event = bare(log.get("eventId") or after.get("event_id"), "EVENT#")
    submission = bare(log.get("entityId"), "SUBMISSION#")
    recorded = timestamp(log.get("timestamp"))
    if not event or not submission or submission == "N/A" or not recorded:
        return None
    # Conflicting explicit links are not reliable evidence.
    if after.get("event_id") and bare(after["event_id"], "EVENT#") != event:
        return None
    if after.get("submission_id") and bare(after["submission_id"], "SUBMISSION#") != submission:
        return None
    return (event, submission), recorded


def final_evidence(note: dict[str, Any], submission: str) -> str | None:
    if note.get("PK") != f"SUBMISSION#{submission}" or note.get("notif_type") != "fully approved":
        return None
    return timestamp(bare(note.get("SK"), "NOTIFICATION#"))


def conditional_update(table, row, field: str, value: str) -> bool:
    names = {"#field": field}
    values = {":value": value}
    update = "SET #field = :value"
    condition = "attribute_exists(PK) AND attribute_exists(SK) AND attribute_not_exists(#field)"
    if field == "first_submitted_at":
        names["#source"] = "first_submitted_at_source"
        values[":source"] = "linked_creation_evidence"
        update += ", #source = :source"
        condition += " AND attribute_not_exists(#source)"
    try:
        table.update_item(Key={"PK": row["PK"], "SK": row["SK"]},
                          UpdateExpression=update, ConditionExpression=condition,
                          ExpressionAttributeNames=names, ExpressionAttributeValues=values)
        return True
    except Exception as error:
        if getattr(error, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def backfill(table, activity_table, apply: bool = False) -> dict[str, Any]:
    counts: Counter[str] = Counter()
    creations: dict[tuple[str, str], set[str]] = defaultdict(set)
    for log in pages(activity_table.scan, FilterExpression="#action = :create", ExpressionAttributeNames={"#action": "actionType"}, ExpressionAttributeValues={":create": "SUBMISSION_CREATE"}):
        evidence = creation_evidence(log)
        if evidence:
            creations[evidence[0]].add(evidence[1])
    submissions = list(pages(table.scan,
                            FilterExpression="begins_with(PK, :event) AND begins_with(SK, :submission)",
                            ExpressionAttributeValues={":event": "EVENT#", ":submission": "SUBMISSION#"},
                            ProjectionExpression="PK, SK, first_submitted_at, first_submitted_at_source, fully_approved_at"))
    identities = Counter(row["SK"] for row in submissions)
    for row in submissions:
        counts["submissions_examined"] += 1
        event = bare(row["PK"], "EVENT#")
        submission = bare(row["SK"], "SUBMISSION#")
        candidates: dict[str, str] = {}
        if "first_submitted_at" not in row and "first_submitted_at_source" not in row:
            evidence = creations.get((event, submission), set())
            # Multiple different creation records are ambiguous, not a minimum.
            if len(evidence) == 1:
                candidates["first_submitted_at"] = next(iter(evidence))
            else:
                counts["first_date_unrecoverable"] += 1
        if "fully_approved_at" not in row:
            if identities[row["SK"]] != 1:
                counts["ambiguous_submission_identity"] += 1
            else:
                notes = pages(table.query,
                              KeyConditionExpression="PK = :pk AND begins_with(SK, :note)",
                              ExpressionAttributeValues={":pk": row["SK"], ":note": "NOTIFICATION#"},
                              ConsistentRead=True)
                evidence = sorted({value for note in notes if (value := final_evidence(note, submission))})
                if evidence:
                    candidates["fully_approved_at"] = evidence[0]
                else:
                    counts["approval_date_unrecoverable"] += 1
        first = timestamp(candidates.get("first_submitted_at") or row.get("first_submitted_at"))
        approved = timestamp(candidates.get("fully_approved_at") or row.get("fully_approved_at"))
        if first and approved and approved < first:
            counts["conflicting_chronology"] += 1
            continue
        for field, value in candidates.items():
            counts[f"proposed_{field}"] += 1
            if apply:
                counts["updated" if conditional_update(table, row, field, value) else "concurrently_populated_or_removed"] += 1
    return {"mode": "apply" if apply else "dry-run", "coverage": "Only retained explicit evidence; unknown dates remain absent.", **dict(counts)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", required=True, help="Main Apex DynamoDB table")
    parser.add_argument("--activity-table", required=True, help="Activity log DynamoDB table")
    parser.add_argument("--region", default="ap-southeast-1")
    parser.add_argument("--profile", help="Existing AWS profile; no credentials are stored")
    parser.add_argument("--endpoint-url", help="Optional local DynamoDB endpoint")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Read and report only (default)")
    mode.add_argument("--apply", action="store_true", help="Write conditional updates; requires separate approval")
    args = parser.parse_args()
    import boto3
    from botocore.config import Config
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    dynamo = session.resource("dynamodb", endpoint_url=args.endpoint_url,
                             config=Config(retries={"max_attempts": 5, "mode": "standard"}))
    print(json.dumps(backfill(dynamo.Table(args.table), dynamo.Table(args.activity_table), args.apply), indent=2))


if __name__ == "__main__":
    main()
