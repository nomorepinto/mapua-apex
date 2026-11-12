"""Recover per-desk turnaround timings for submissions filed before desk_timings existed.

Dry-run is the default. Review its counts and obtain separate approval before
adding --apply. Run only after deploying the desk-timing writer so live decisions
are never clobbered: every write is conditional on attribute_not_exists(desk_timings).

Entries are derived only from a paper's own ordered decision notifications
(approved, fully approved, returned, denied). No evidence means no update: a paper
with no decision notifications, no usable first timestamp, or out-of-order
notifications is skipped rather than guessed. Desk durations count Manila working
hours (Mon-Fri 08:00-17:00 at a fixed UTC+8, no holiday calendar); overall span is
wall clock. Every derived entry is marked source="backfill".
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import math
from typing import Any, Iterator

MINUTE_MS = 60_000
DAY_MS = 86_400_000
OFFSET_MS = 8 * 60 * MINUTE_MS
OPEN_MINUTES = 8 * 60
CLOSE_MINUTES = 17 * 60

DECISION_ACTIONS = ("approved", "fully approved", "returned", "denied")

WORKING_HOURS_RULE = "Mon-Fri 08:00-17:00 Asia/Manila, holidays not excluded"


def timestamp(value: Any) -> str | None:
    if not isinstance(value, str) or "T" not in value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    except ValueError:
        return None


def epoch_ms(iso: str) -> int:
    return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)


def bare(value: Any, prefix: str) -> str:
    return value.removeprefix(prefix) if isinstance(value, str) else ""


def wall_minutes(start: str, end: str) -> int | None:
    value = epoch_ms(end) - epoch_ms(start)
    return value // MINUTE_MS if value >= 0 else None


def working_minutes(start: str, end: str) -> int | None:
    """Minutes of overlap between [start, end) and the Manila working window."""
    source = epoch_ms(start)
    target = epoch_ms(end)
    if target < source:
        return None
    shifted_from = source + OFFSET_MS
    shifted_to = target + OFFSET_MS
    first_day = math.floor(shifted_from / DAY_MS)
    last_day = math.floor((shifted_to - 1) / DAY_MS)
    total = 0
    for day in range(first_day, last_day + 1):
        # Unix day 0 was a Thursday; shift so 0 = Sunday like Date#getUTCDay.
        weekday = ((day + 4) % 7 + 7) % 7
        if weekday in (0, 6):
            continue
        open_ms = day * DAY_MS + OPEN_MINUTES * MINUTE_MS
        close_ms = day * DAY_MS + CLOSE_MINUTES * MINUTE_MS
        total += max(0, min(shifted_to, close_ms) - max(shifted_from, open_ms))
    return max(0, round(total / MINUTE_MS))


def pages(method, **kwargs) -> Iterator[dict[str, Any]]:
    while True:
        result = method(**kwargs)
        yield from result.get("Items", [])
        continuation = result.get("LastEvaluatedKey")
        if not continuation:
            return
        kwargs["ExclusiveStartKey"] = continuation


def read_steps(submission: dict[str, Any]) -> dict[str, dict[str, Any]]:
    steps: dict[str, dict[str, Any]] = {}
    raw = submission.get("signatory_steps")
    if not isinstance(raw, list):
        return steps
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        signatory = bare(entry.get("signatory_id"), "SIGNATORY#")
        if not signatory:
            continue
        steps[signatory] = {
            "key": entry.get("key"),
            "role": entry.get("role"),
            "organization_id": bare(entry.get("organization_id"), "ORGANIZATION#") or None,
        }
    return steps


def decision_rows(notifications: list[dict[str, Any]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for note in notifications:
        action = note.get("notif_type")
        if action not in DECISION_ACTIONS:
            continue
        acted = timestamp(note.get("sent_at") or bare(note.get("SK"), "NOTIFICATION#"))
        if not acted:
            continue
        rows.append(
            {
                "action": action,
                "acted_at": acted,
                "signatory_id": bare(note.get("signatory"), "SIGNATORY#"),
            }
        )
    rows.sort(key=lambda row: row["acted_at"])
    return rows


def derive_desk_timings(
    submission: dict[str, Any], notifications: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Rebuild desk_timings from ordered decision notifications, or [] when ambiguous."""
    decisions = decision_rows(notifications)
    if not decisions:
        return []
    anchor = timestamp(submission.get("first_submitted_at") or submission.get("sent_at"))
    steps = read_steps(submission)
    entries: list[dict[str, Any]] = []
    previous = anchor
    for decision in decisions:
        if not previous:
            # No usable anchor for this desk's clock; the evidence is ambiguous.
            return []
        if decision["acted_at"] < previous:
            # Out-of-order evidence; skip the paper rather than record a negative.
            return []
        step = steps.get(decision["signatory_id"], {})
        entries.append(
            {
                "stage_key": step.get("key"),
                "role": step.get("role"),
                "signatory_id": decision["signatory_id"],
                "organization_id": step.get("organization_id"),
                "action": decision["action"],
                "entered_at": previous,
                "acted_at": decision["acted_at"],
                "wall_minutes": wall_minutes(previous, decision["acted_at"]),
                "working_minutes": working_minutes(previous, decision["acted_at"]),
                "source": "backfill",
            }
        )
        previous = decision["acted_at"]
    return entries


def conditional_update(table, row: dict[str, Any], entries: list[dict[str, Any]]) -> bool:
    try:
        table.update_item(
            Key={"PK": row["PK"], "SK": row["SK"]},
            UpdateExpression="SET desk_timings = :value",
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK) AND attribute_not_exists(desk_timings)",
            ExpressionAttributeValues={":value": entries},
        )
        return True
    except Exception as error:
        if getattr(error, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def backfill(table, apply: bool = False, limit: int | None = None) -> dict[str, Any]:
    counts: Counter[str] = Counter()
    rows = pages(
        table.scan,
        FilterExpression="begins_with(PK, :event) AND begins_with(SK, :submission) AND attribute_not_exists(desk_timings)",
        ExpressionAttributeValues={":event": "EVENT#", ":submission": "SUBMISSION#"},
        ProjectionExpression="PK, SK, first_submitted_at, sent_at, signatory_steps",
    )
    for row in rows:
        if limit is not None and counts["submissions_examined"] >= limit:
            break
        counts["submissions_examined"] += 1
        notes = list(
            pages(
                table.query,
                KeyConditionExpression="PK = :pk AND begins_with(SK, :note)",
                ExpressionAttributeValues={":pk": row["SK"], ":note": "NOTIFICATION#"},
                ConsistentRead=True,
            )
        )
        if not decision_rows(notes):
            counts["no_decision_notifications"] += 1
            continue
        entries = derive_desk_timings(row, notes)
        if not entries:
            counts["ambiguous_evidence"] += 1
            continue
        counts["proposed_desk_timings"] += 1
        counts["proposed_desk_timing_entries"] += len(entries)
        if apply:
            counts["updated" if conditional_update(table, row, entries) else "skipped_existing"] += 1
    return {
        "mode": "apply" if apply else "dry-run",
        "coverage": f"Only a paper's own decision notifications; desk durations count {WORKING_HOURS_RULE}.",
        **dict(counts),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", required=True, help="Main Apex DynamoDB table")
    parser.add_argument("--region", default="ap-southeast-1")
    parser.add_argument("--profile", help="Existing AWS profile; no credentials are stored")
    parser.add_argument("--endpoint-url", help="Optional local DynamoDB endpoint")
    parser.add_argument("--limit", type=int, help="Cap the number of submissions examined")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Read and report only (default)")
    mode.add_argument("--apply", action="store_true", help="Write conditional updates; requires separate approval")
    args = parser.parse_args()
    import boto3
    from botocore.config import Config
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    dynamo = session.resource(
        "dynamodb",
        endpoint_url=args.endpoint_url,
        config=Config(retries={"max_attempts": 5, "mode": "standard"}),
    )
    print(json.dumps(backfill(dynamo.Table(args.table), args.apply, args.limit), indent=2))


if __name__ == "__main__":
    main()
