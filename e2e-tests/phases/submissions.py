"""Create one paper per routing path and assert the signatory lineup."""

from __future__ import annotations

import uuid

from apex_client import ApiError
from fixtures import reservation, saaf_body
from phases.context import Paper, RunContext
from report import Step


def _lineup(ctx: RunContext, *keys: str) -> list[str]:
    return [ctx.ids[key] for key in keys]


def _submit(ctx: RunContext, key: str, org: str, payload: dict, expected: list[str], title: str) -> None:
    client = ctx.client(org)
    try:
        created = client.request("POST", "/students/submissions", payload)
    except ApiError as error:
        ctx.report.add(Step(f"submit {key}", "fail", str(error), error.status))
        if not ctx.keep_going:
            raise SystemExit(1)
        return
    event_id = created.get("event_id") or payload["event_id"]
    submission_id = created.get("submission_id")
    ctx.manifest.add_id(event_id)
    ctx.manifest.add_id(submission_id)
    observed = list(created.get("signatory_sequence") or [])
    paper = Paper(key, event_id, submission_id, org, expected, payload, title)
    ctx.papers[key] = paper
    if observed != expected:
        ctx.report.add(
            Step(
                f"submit {key}",
                "fail",
                f"lineup {observed} expected {expected}",
            )
        )
        if not ctx.keep_going:
            raise SystemExit(1)
        return
    desk = created.get("current_signatory")
    if desk != expected[0]:
        ctx.report.add(Step(f"submit {key}", "fail", f"first desk {desk}"))
        if not ctx.keep_going:
            raise SystemExit(1)
        return
    ctx.report.add(Step(f"submit {key}", "pass", " -> ".join(expected)))


def run(ctx: RunContext) -> None:
    date = ctx.date_key
    day = ctx.day_name
    campus = ctx.ids["campus"]
    osaar = ("osaar1", "osaar2")

    def body(title, activity, venue, reserved, reservations=None, dependents=None, org="orgA"):
        return saaf_body(
            event_id=str(uuid.uuid4()),
            title=title,
            activity_type=activity,
            event_date=date,
            day_name=day,
            venue=venue,
            has_reservation=reserved,
            reservations=reservations,
            dependents=dependents,
            email=ctx.accounts[org]["email"],
            student_number="2026100101",
        )

    room = lambda slot, name, kind, reservable: [
        reservation(ctx.ids[reservable], campus, name, kind, date, slot)
    ]
    specs = [
        ("P1", "orgA", body("Extra Online", "extra-curricular", "Online", False), _lineup(ctx, "adv1", *osaar)),
        ("P2", "orgA", body("Extra Room", "extra-curricular", f"Campus {ctx.tag}", True, room(0, "R101", "room", "classroom")), _lineup(ctx, "adv1", *osaar, "cdm1")),
        ("P3", "orgA", body("Co Online", "co-curricular", "Online", False), _lineup(ctx, "adv1", "dean1", *osaar)),
        (
            "P4",
            "orgA",
            body(
                "Co Room Equipment",
                "co-curricular",
                f"Campus {ctx.tag}",
                True,
                room(2, "Auditorium", "room", "auditorium")
                + room(2, "Projector", "equipment", "projector"),
            ),
            _lineup(ctx, "adv1", "dean1", *osaar, "cdm1"),
        ),
        (
            "P5",
            "orgA",
            body("Co Collab", "co-curricular", "Online", False, dependents=[ctx.ids["orgB"]]),
            _lineup(ctx, "adv1", "adv2", "dean1", "dean2", *osaar),
        ),
        (
            "P6",
            "orgC",
            body("Council Room", "co-curricular", f"Campus {ctx.tag}", True, room(1, "R101", "room", "classroom"), org="orgC"),
            _lineup(ctx, "adv3", *osaar, "cdm1"),
        ),
        (
            "P7",
            "orgC",
            body(
                "Council Collab",
                "co-curricular",
                "Online",
                False,
                dependents=[ctx.ids["orgA"]],
                org="orgC",
            ),
            _lineup(ctx, "adv3", "adv1", "dean1", *osaar),
        ),
        ("P9", "orgA", body("Deny Adviser", "extra-curricular", "Online", False), _lineup(ctx, "adv1", *osaar)),
        ("P10", "orgA", body("Deny Dean", "co-curricular", "Online", False), _lineup(ctx, "adv1", "dean1", *osaar)),
        ("P11", "orgA", body("Deny Osaar One", "extra-curricular", "Online", False), _lineup(ctx, "adv1", *osaar)),
        ("P12", "orgA", body("Deny Osaar Two", "extra-curricular", "Online", False), _lineup(ctx, "adv1", *osaar)),
        (
            "P13",
            "orgA",
            body("Deny Cdm", "extra-curricular", f"Campus {ctx.tag}", True, room(4, "R101", "room", "classroom")),
            _lineup(ctx, "adv1", *osaar, "cdm1"),
        ),
        (
            "P14",
            "orgA",
            body("Conflict Hold", "extra-curricular", f"Campus {ctx.tag}", True, room(3, "R101", "room", "classroom")),
            _lineup(ctx, "adv1", *osaar, "cdm1"),
        ),
    ]
    for key, org, payload, expected in specs:
        _submit(ctx, key, org, payload, expected, payload["activity_details"]["title_and_nature"])

    equipment_only = body(
        "Equipment Only",
        "extra-curricular",
        f"Campus {ctx.tag}",
        True,
        room(5, "Projector", "equipment", "projector"),
    )
    status, payload = ctx.client("orgA").call("POST", "/students/submissions", equipment_only)
    if isinstance(payload, dict) and payload.get("event_id"):
        ctx.manifest.add_id(payload.get("event_id"))
        ctx.manifest.add_id(payload.get("submission_id"))
    if status == 422:
        ctx.report.add(Step("submit P8 equipment only", "pass", "422 as expected", status))
    else:
        ctx.report.add(Step("submit P8 equipment only", "fail", f"expected 422, got {status}", status))
        if not ctx.keep_going:
            raise SystemExit(1)
