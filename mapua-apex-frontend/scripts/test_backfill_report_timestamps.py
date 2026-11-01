"""Offline migration regression tests. No boto3 import, credentials, or AWS calls."""
from copy import deepcopy
import unittest
from backfill_report_timestamps import backfill, creation_evidence, final_evidence, timestamp


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
        return {"Items": [note for note in self.notes if note["PK"] == kwargs["ExpressionAttributeValues"][":pk"]]}

    def update_item(self, **kwargs):
        self.writes.append(kwargs)
        if self.conflict:
            raise ConditionalConflict()
        row = next(row for row in self.rows if all(row[key] == value for key, value in kwargs["Key"].items()))
        names = kwargs["ExpressionAttributeNames"]
        values = kwargs["ExpressionAttributeValues"]
        field = names["#field"]
        if field in row or ("#source" in names and names["#source"] in row):
            raise ConditionalConflict()
        row[field] = values[":value"]
        if "#source" in names:
            row[names["#source"]] = values[":source"]


def creation(**extra):
    return {"actionType": "SUBMISSION_CREATE", "module": "SUBMISSION", "eventId": "e", "entityId": "s", "timestamp": "2024-01-01T00:00:00Z", **extra}


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.table = Table([{"PK": "EVENT#e", "SK": "SUBMISSION#s"}], [{"PK": "SUBMISSION#s", "SK": "NOTIFICATION#2024-01-02T00:00:00Z", "notif_type": "fully approved"}])
        self.logs = Table([creation()])

    def test_dry_run_is_default_and_traverses_empty_pages(self):
        result = backfill(self.table, self.logs)
        self.assertEqual(result["mode"], "dry-run")
        self.assertEqual(result["proposed_first_submitted_at"], 1)
        self.assertEqual(result["proposed_fully_approved_at"], 1)
        self.assertEqual(self.table.writes, [])

    def test_apply_is_idempotent_and_uses_absence_conditions(self):
        self.assertEqual(backfill(self.table, self.logs, True)["updated"], 2)
        self.assertIn("attribute_not_exists(#source)", self.table.writes[0]["ConditionExpression"])
        self.assertIn("attribute_exists(PK)", self.table.writes[0]["ConditionExpression"])
        self.assertEqual(backfill(self.table, self.logs, True).get("updated", 0), 0)
        self.assertEqual(self.table.rows[0]["first_submitted_at_source"], "linked_creation_evidence")

    def test_concurrent_population_is_not_overwritten(self):
        self.table.conflict = True
        result = backfill(self.table, self.logs, True)
        self.assertEqual(result["concurrently_populated_or_removed"], 2)
        self.assertNotIn("first_submitted_at", self.table.rows[0])

    def test_unknown_ambiguous_or_conflicting_evidence_is_not_guessed(self):
        self.logs.rows = [creation(timestamp="2024-01-01T00:00:00Z"), creation(timestamp="2024-01-01T01:00:00Z")]
        self.assertEqual(backfill(self.table, self.logs)["first_date_unrecoverable"], 1)
        self.logs.rows = [creation(timestamp="2024-01-03T00:00:00Z")]
        self.assertEqual(backfill(self.table, self.logs)["conflicting_chronology"], 1)
        self.logs.rows = []
        self.assertNotIn("proposed_first_submitted_at", backfill(self.table, self.logs))

    def test_duplicate_submission_identity_cannot_link_final_notice(self):
        self.table.rows.append({"PK": "EVENT#other", "SK": "SUBMISSION#s"})
        result = backfill(self.table, self.logs)
        self.assertEqual(result["ambiguous_submission_identity"], 2)
        self.assertNotIn("proposed_fully_approved_at", result)

    def test_only_linked_server_creation_and_explicit_final_approval_qualify(self):
        self.assertIsNone(creation_evidence(creation(eventId=None, after={"sent_at": "2024-01-01T00:00:00Z"})))
        self.assertIsNone(creation_evidence(creation(after={"event_id": "other"})))
        self.assertIsNone(creation_evidence(creation(entityId="N/A")))
        self.assertIsNone(final_evidence({"PK": "SUBMISSION#s", "SK": "NOTIFICATION#2024-01-01T00:00:00Z", "notif_type": "approved"}, "s"))
        self.assertIsNone(timestamp("2024-01-01"))
        self.assertIsNone(timestamp("2024-01-01T00:00:00"))
        self.assertIsNone(timestamp("2999-01-01T00:00:00Z"))
        self.assertEqual(timestamp("2024-01-01T08:00:00+08:00"), "2024-01-01T00:00:00.000Z")


if __name__ == "__main__":
    unittest.main()
