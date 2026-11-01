"""Attendance registration, check-in, and one evaluation."""

from __future__ import annotations

from apex_client import ApiError
from arcus_client import ArcusSession
from fixtures import STUDENT_NUMBERS, evaluation_draft
from phases.context import RunContext
from report import Step


def _fail(ctx: RunContext, name: str, detail: str, http: int | None = None) -> None:
    ctx.report.add(Step(name, "fail", detail, http))
    if not ctx.keep_going:
        raise SystemExit(1)


def run(ctx: RunContext) -> None:
    if ctx.skip_day_of:
        ctx.report.add(Step("arcus", "skip", "event date is not today"))
        return
    paper = ctx.papers.get("P2")
    council = ctx.papers.get("P6")
    if not paper:
        _fail(ctx, "arcus", "P2 was not approved")
        return
    for key in ("stu1", "stu2"):
        ctx.manifest.add_student_number(STUDENT_NUMBERS[key])
    ctx.manifest.add_student_number(STUDENT_NUMBERS["unregistered"])

    def session(base: str, key: str) -> ArcusSession:
        account = ctx.accounts[key]
        return ArcusSession(ctx.settings, base, key, account["email"], account["password"])

    try:
        for key, number in (("stu1", STUDENT_NUMBERS["stu1"]), ("stu2", STUDENT_NUMBERS["stu2"])):
            attendance = session(ctx.settings.attendance_base, key)
            status, body = attendance.request(
                "POST",
                "/api/forms",
                {
                    "full_name": f"Student {key}",
                    "student_id": number,
                    "course": "BS Information Technology",
                    "department": "School of Information Technology",
                },
            )
            if status >= 400:
                raise RuntimeError(f"{key} registration {status}: {body}")
        officer = session(ctx.settings.attendance_base, "orgA")
        for number in (STUDENT_NUMBERS["stu1"], STUDENT_NUMBERS["stu2"]):
            status, body = officer.request(
                "POST",
                "/api/checkin",
                {"eventId": paper.event_id, "student_id": number},
            )
            if status >= 400:
                raise RuntimeError(f"check-in {number} {status}: {body}")
        status, _ = officer.request(
            "POST",
            "/api/checkin",
            {"eventId": paper.event_id, "student_id": STUDENT_NUMBERS["stu1"]},
        )
        if status != 409:
            raise RuntimeError(f"duplicate scan returned {status}")
        status, _ = officer.request(
            "POST",
            "/api/checkin",
            {"eventId": paper.event_id, "student_id": STUDENT_NUMBERS["unregistered"]},
        )
        if status != 404:
            raise RuntimeError(f"unregistered scan returned {status}")
        status, _ = officer.request(
            "POST",
            "/api/checkin",
            {
                "eventId": paper.event_id,
                "student_id": STUDENT_NUMBERS["stu1"],
                "membersOnly": True,
                "organizationId": ctx.ids["orgA"],
            },
        )
        ctx.report.add(Step("arcus attendance", "pass", f"members-only follow-up {status}"))

        ctx.refresh("stu1")
        evaluation = session(ctx.settings.evaluation_base, "stu1")
        status, body = evaluation.request(
            "POST",
            "/api/evaluations",
            evaluation_draft(paper.event_id, paper.title, STUDENT_NUMBERS["stu1"], ctx.date_key),
        )
        if status >= 400:
            raise RuntimeError(f"evaluation {status}: {body}")
        officer_eval = session(ctx.settings.evaluation_base, "orgA")
        status, body = officer_eval.request("GET", f"/api/events/{paper.event_id}/post-eval")
        count = body.get("attendance_count") if isinstance(body, dict) else None
        if status >= 400 or not count or count < 2:
            raise RuntimeError(f"officer panel {status}: {body}")
        ctx.report.add(Step("arcus evaluation", "pass", f"attendance_count {count}", status))
        if council:
            ctx.report.add(Step("council event stays attendance-only", "pass", council.key))
    except (ApiError, RuntimeError) as error:
        status = error.status if isinstance(error, ApiError) else None
        _fail(ctx, "arcus", str(error), status)
