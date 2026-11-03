"""Preselected data for one run. Names stay letters-only because the forms reject digits."""

from __future__ import annotations

import secrets
import string
from datetime import date

ACCOUNT_KEYS = [
    "admin",
    "adv1",
    "adv2",
    "adv3",
    "dean1",
    "dean2",
    "osaar1",
    "osaar2",
    "osaarAll",
    "cdm1",
    "orgA",
    "orgB",
    "orgC",
    "stu1",
    "stu2",
]

SIGNATORY_KEYS = ["adv1", "adv2", "adv3", "dean1", "dean2", "osaar1", "osaar2", "osaarAll", "cdm1"]
ORG_KEYS = ["orgA", "orgB", "orgC"]
STUDENT_KEYS = ["stu1", "stu2"]

# Year 2026 is inside the attendance validator's allowed span. These numbers
# belong to the suite and are the only STUDENT# rows it deletes.
STUDENT_NUMBERS = {
    "stu1": "2026100001",
    "stu2": "2026100002",
    "unregistered": "2026100003",
}

SHARED_PASSWORD = "ApexE2e!Passw0rd"
PLUS_TAG = "apexe2e"

ALIGNMENT = (
    "This activity develops leadership and service among members while "
    "keeping the work aligned with the university mission and goals."
)
SUMMARY = (
    "The organization completed the activity as scheduled. Attendance matched "
    "the plan, the budget stayed within the approved lines, and the members "
    "recorded what should change before the next run of this event."
)


def run_tag() -> str:
    alphabet = string.ascii_letters
    return "".join(secrets.choice(alphabet) for _ in range(4))


def weekday_name(value: date) -> str:
    return value.strftime("%A")


def open_schedule() -> dict[str, list[bool]]:
    open_day = [True] * 12
    closed = [False] * 12
    return {
        "monday": open_day,
        "tuesday": list(open_day),
        "wednesday": list(open_day),
        "thursday": list(open_day),
        "friday": list(open_day),
        "saturday": list(open_day),
        "sunday": closed,
    }


def proponent(email: str, student_number: str) -> dict:
    return {
        "first_name": "Ana",
        "last_name": "Reyes",
        "position_of_applicant": "President",
        "student_number": student_number,
        "contact_number": "09171234567",
        "email_address": email,
        "department": "School of Information Technology",
    }


def budget() -> dict:
    return {
        "items": [
            {
                "item_no": "1",
                "unit": "set",
                "quantity": 1,
                "price_per_unit": 100,
                "total": 100,
            }
        ],
        "grand_total": 100,
    }


def saaf_body(
    *,
    event_id: str,
    title: str,
    activity_type: str,
    event_date: str,
    day_name: str,
    venue: str,
    has_reservation: bool,
    reservations: list[dict] | None = None,
    dependents: list[str] | None = None,
    email: str,
    student_number: str,
) -> dict:
    return {
        "event_id": event_id,
        "submission_type": "saaf",
        "collaboration": {"dependent_organization_ids": dependents or []},
        "activity_classification": {
            "activity_type": activity_type,
            "total_org_members": 40,
        },
        "proponents": [proponent(email, student_number)],
        "activity_details": {
            "title_and_nature": title,
            "description": ALIGNMENT,
            "objectives": ALIGNMENT,
            "venue": venue,
            "date_of_event": event_date,
            "end_date_of_event": event_date,
            "day_of_event": day_name,
            "time_of_event": "08:00-09:20",
            "expected_participants": 40,
            "individual_contribution": 0,
            "proposed_budget": 100,
        },
        "institutional_alignment": {
            "mission_statements": {
                "competitive": True,
                "research": False,
                "solutions": False,
            },
            "core_values_explanation": ALIGNMENT,
            "sdg_explanation": ALIGNMENT,
        },
        "detailed_budget_proposal": budget(),
        "venue_reservation": {
            "has_reservation": has_reservation,
            "reservations": reservations or [],
        },
    }


def reservation(reservable_id: str, campus_id: str, name: str, kind: str, event_date: str, slot: int) -> dict:
    return {
        "reservable_id": reservable_id,
        "campus_id": campus_id,
        "name": name,
        "type": kind,
        "selections": [{"date": event_date, "slots": [slot]}],
        "remarks": "Room purpose for the end to end reservation check.",
    }


def posteval_body(event_id: str, submission_id: str) -> dict:
    return {
        "event_id": event_id,
        "submission_id": submission_id,
        "section_summary": SUMMARY,
        "financial_report": {
            "budget_items": [{"item": "Supplies", "actual_amount": 100, "budgeted_total": 100}],
            "added_items": [],
            "initial_grand_total": 100,
            "actual_grand_total": 100,
        },
    }


def evaluation_draft(event_id: str, title: str, student_id: str, event_date: str) -> dict:
    criteria = [
        "meaningfulness",
        "promotion",
        "materials",
        "production",
        "flow",
        "eventDate",
        "venue",
        "transportation",
        "otherBenefits",
        "effectiveness",
        "mastery",
        "attentiveness",
        "fairness",
        "communication",
        "grooming",
        "punctuality",
        "objectiveMet",
        "mapuanCoreValues",
        "overallSatisfaction",
        "impact",
        "missionAdherence",
        "peoAdherence",
        "poAdherence",
    ]
    return {
        "draft": {
            "eventId": event_id,
            "eventTitle": title,
            "studentId": student_id,
            "department": "School of Information Technology",
            "participated": "yes",
            "recentActivity": "General assembly planning session",
            "dateParticipated": event_date,
            "discoverySources": {
                "classmateSchoolmate": True,
                "faculty": False,
                "others": False,
                "onlineMitWebsite": False,
                "referenceMaterialsPromotion": False,
            },
            "othersSpecify": "",
            "ratings": {criterion: 5 for criterion in criteria},
            "comments": "Clear and well organized.",
        }
    }
