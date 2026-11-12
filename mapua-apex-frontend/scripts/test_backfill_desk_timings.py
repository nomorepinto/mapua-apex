"""Offline desk-timing migration tests. No boto3 import, credentials, or AWS calls."""
from copy import deepcopy
import unittest
from backfill_desk_timings import (
    backfill,
    derive_desk_timings,
    wall_minutes,
    working_minutes,
)


class ConditionalConflict(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class Table:
    def __init__(self, rows, notes=None):
        self.rows = deepcopy(rows)
        self.notes = notes or []
        self.writes = []
        self.conflict = False

    def scan(self, **kwargs):
        offset = kwargs.get("ExclusiveStartKey", {}).get("offset", 0)
        # Include an empty filtered page before the data.
        if offset == 0:
            return {"Items": [], "LastEvaluatedKey": {"offset": 1}}
        return {"Items": self.rows}

    def query(self, **kwargs):
        pk = kwargs["ExpressionAttributeValues"][":pk"]
        return {"Items": [note for note in self.notes if note["PK"] == pk]}

    def update_item(self, **kwargs):
        self.writes.append(kwargs)
        if self.conflict:
            raise ConditionalConflict()
        row = next(
            row
            for row in self.rows
            if all(row[key] == value for key, value in kwargs["Key"].items())
        )
        if "desk_timings" in row:
            raise ConditionalConflict()
        row["desk_timings"] = kwargs["ExpressionAttributeValues"][":value"]


# Manila is UTC+8: 2026-11-02 is a Monday, so 02:00Z/04:00Z/06:00Z are 10:00/12:00/14:00.
def submission(**extra):
    return {
        "PK": "EVENT#e",
        "SK": "SUBMISSION#s",
        "first_submitted_at": "2026-11-02T02:00:00Z",
        "signatory_steps": [
            {
                "key": "adviser_1",
                "role": "adviser",
                "signatory_id": "SIGNATORY#adviser",
                "organization_id": "ORGANIZATION#orgA",
            },
            {
                "key": "osaar_1",
                "role": "osaar",
                "signatory_id": "SIGNATORY#osaar",
                "organization_id": None,
            },
        ],
        **extra,
    }


def note(signatory, notif_type, sent_at):
    return {
        "PK": "SUBMISSION#s",
        "SK": f"NOTIFICATION#{sent_at}",
        "signatory": f"SIGNATORY#{signatory}",
        "notif_type": notif_type,
        "sent_at": sent_at,
    }


def decisions():
    return [
        note("osaar", "fully approved", "2026-11-02T06:00:00Z"),
        note("adviser", "approved", "2026-11-02T04:00:00Z"),
    ]


class WorkingMinuteTests(unittest.TestCase):
    def test_counts_a_same_day_span_inside_working_hours(self):
        self.assertEqual(
            working_minutes("2026-11-02T02:00:00Z", "2026-11-02T04:00:00Z"), 120
        )
        self.assertEqual(
            wall_minutes("2026-11-02T02:00:00Z", "2026-11-02T04:00:00Z"), 120
        )

    def test_clamps_to_the_working_window(self):
        # Monday 07:00 -> 19:00 Manila: only 08:00-17:00 counts.
        self.assertEqual(
            working_minutes("2026-11-01T23:00:00Z", "2026-11-02T11:00:00Z"), 540
        )

    def test_skips_the_weekend(self):
        # Saturday 09:00 -> Sunday 18:00 Manila.
        self.assertEqual(
            working_minutes("2026-11-14T01:00:00Z", "2026-11-15T10:00:00Z"), 0
        )

    def test_returns_none_on_a_reversed_pair(self):
        self.assertIsNone(
            working_minutes("2026-11-02T04:00:00Z", "2026-11-02T02:00:00Z")
        )


class DeriveTests(unittest.TestCase):
    def test_builds_backfill_entries_in_decision_order_resolving_roles(self):
        entries = derive_desk_timings(submission(), decisions())
        self.assertEqual(len(entries), 2)
        self.assertEqual(
            entries[0],
            {
                "stage_key": "adviser_1",
                "role": "adviser",
                "signatory_id": "adviser",
                "organization_id": "orgA",
                "action": "approved",
                "entered_at": "2026-11-02T02:00:00.000Z",
                "acted_at": "2026-11-02T04:00:00.000Z",
                "wall_minutes": 120,
                "working_minutes": 120,
                "source": "backfill",
            },
        )
        self.assertEqual(entries[1]["signatory_id"], "osaar")
        self.assertEqual(entries[1]["entered_at"], "2026-11-02T04:00:00.000Z")
        self.assertEqual(entries[1]["working_minutes"], 120)

    def test_ignores_non_decision_notifications(self):
        notes = decisions() + [note("adviser", "submitted", "2026-11-02T02:00:00Z")]
        self.assertEqual(len(derive_desk_timings(submission(), notes)), 2)

    def test_empty_when_no_decisions(self):
        self.assertEqual(
            derive_desk_timings(submission(), [note("adviser", "submitted", "2026-11-02T02:00:00Z")]),
            [],
        )

    def test_empty_on_out_of_order_evidence(self):
        notes = [note("adviser", "approved", "2026-11-02T00:00:00Z")]
        self.assertEqual(derive_desk_timings(submission(), notes), [])

    def test_empty_without_a_submission_anchor(self):
        paper = submission()
        del paper["first_submitted_at"]
        self.assertEqual(derive_desk_timings(paper, decisions()), [])


class BackfillTests(unittest.TestCase):
    def setUp(self):
        self.table = Table([submission()], decisions())

    def test_dry_run_is_the_default_and_writes_nothing(self):
        result = backfill(self.table)
        self.assertEqual(result["mode"], "dry-run")
        self.assertEqual(result["submissions_examined"], 1)
        self.assertEqual(result["proposed_desk_timings"], 1)
        self.assertEqual(result["proposed_desk_timing_entries"], 2)
        self.assertEqual(self.table.writes, [])

    def test_apply_is_conditional_and_idempotent(self):
        self.assertEqual(backfill(self.table, True)["updated"], 1)
        self.assertIn(
            "attribute_not_exists(desk_timings)",
            self.table.writes[0]["ConditionExpression"],
        )
        self.assertEqual(len(self.table.rows[0]["desk_timings"]), 2)
        self.assertEqual(backfill(self.table, True)["skipped_existing"], 1)

    def test_concurrent_population_is_not_overwritten(self):
        self.table.conflict = True
        result = backfill(self.table, True)
        self.assertEqual(result["skipped_existing"], 1)
        self.assertNotIn("desk_timings", self.table.rows[0])

    def test_papers_without_decisions_are_counted_and_skipped(self):
        self.table.notes = [note("adviser", "submitted", "2026-11-02T02:00:00Z")]
        self.assertEqual(backfill(self.table)["no_decision_notifications"], 1)

    def test_ambiguous_papers_are_counted_and_skipped(self):
        self.table.notes = [note("adviser", "approved", "2026-11-02T00:00:00Z")]
        self.assertEqual(backfill(self.table)["ambiguous_evidence"], 1)

    def test_limit_caps_the_number_examined(self):
        self.table.rows.append(submission(SK="SUBMISSION#s2"))
        self.assertEqual(backfill(self.table, limit=1)["submissions_examined"], 1)


if __name__ == "__main__":
    unittest.main()
