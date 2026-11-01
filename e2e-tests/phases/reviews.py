"""Return, deny, and approve at every desk, plus the routing-change cases."""

from __future__ import annotations

import uuid

from apex_client import ApiError
from fixtures import saaf_body
from phases.context import Paper, RunContext
from report import Step

DESK_KEYS = ["adv1", "adv2", "adv3", "dean1", "dean2", "osaar1", "osaar2", "cdm1"]


def _account_for(ctx: RunContext, signatory_id: str) -> str:
    for key in DESK_KEYS:
        if ctx.ids.get(key) == signatory_id:
            return key
    raise KeyError(signatory_id)


def _get(ctx: RunContext, paper: Paper) -> dict:
    return ctx.client(paper.org).request(
        "GET",
        f"/students/events/{paper.event_id}/submissions/{paper.submission_id}",
    )


def _put(ctx: RunContext, paper: Paper, payload: dict) -> dict:
    body = {key: value for key, value in payload.items() if key != "event_id"}
    return ctx.client(paper.org).request(
        "PUT",
        f"/students/events/{paper.event_id}/submissions/{paper.submission_id}",
        body,
    )


def _act(ctx: RunContext, paper: Paper, signatory_id: str, action: str, body: dict | None = None) -> dict:
    account = _account_for(ctx, signatory_id)
    client = ctx.client(account)
    if account in ("osaar1", "osaar2") and action == "approve":
        client.request(
            "PATCH",
            f"/signatories/events/{paper.event_id}/submissions/{paper.submission_id}/classification",
            {"nature": "major"},
        )
    return client.request(
        "POST",
        f"/signatories/events/{paper.event_id}/submissions/{paper.submission_id}/{action}",
        body if body is not None else {},
    )


def _fail(ctx: RunContext, name: str, error: Exception) -> None:
    status = error.status if isinstance(error, ApiError) else None
    ctx.report.add(Step(name, "fail", str(error), status))
    if not ctx.keep_going:
        raise SystemExit(1)


def return_then_approve(ctx: RunContext, paper: Paper) -> None:
    name = f"return and approve {paper.key}"
    try:
        for signatory_id in paper.lineup:
            _act(ctx, paper, signatory_id, "return", {"comment": "Please revise this section."})
            returned = _get(ctx, paper)
            if returned.get("status") != "returned" or returned.get("current_signatory") != signatory_id:
                raise RuntimeError(
                    f"after return status={returned.get('status')} desk={returned.get('current_signatory')}"
                )
            _put(ctx, paper, paper.payload)
            resubmitted = _get(ctx, paper)
            if resubmitted.get("status") != "pending" or resubmitted.get("current_signatory") != signatory_id:
                raise RuntimeError(
                    f"after resubmit status={resubmitted.get('status')} desk={resubmitted.get('current_signatory')}"
                )
            _act(ctx, paper, signatory_id, "approve")
        final = _get(ctx, paper)
        if final.get("status") != "approved":
            raise RuntimeError(f"finished as {final.get('status')}")
        ctx.report.add(Step(name, "pass", "resumed at each desk"))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)


def deny_at(ctx: RunContext, paper: Paper, desk_key: str) -> None:
    name = f"deny {paper.key} at {desk_key}"
    target = ctx.ids[desk_key]
    try:
        for signatory_id in paper.lineup:
            if signatory_id == target:
                _act(ctx, paper, signatory_id, "deny", {"comment": "This proposal is denied."})
                break
            _act(ctx, paper, signatory_id, "approve")
        else:
            raise RuntimeError(f"{desk_key} is not in the lineup")
        status, _ = ctx.client(paper.org).call(
            "PUT",
            f"/students/events/{paper.event_id}/submissions/{paper.submission_id}",
            {key: value for key, value in paper.payload.items() if key != "event_id"},
        )
        if status != 422:
            raise RuntimeError(f"editing a denied paper returned {status}")
        ctx.report.add(Step(name, "pass", "edit after deny is 422", status))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)


def approve_all(ctx: RunContext, paper: Paper) -> None:
    name = f"approve {paper.key}"
    try:
        for signatory_id in paper.lineup:
            _act(ctx, paper, signatory_id, "approve")
        final = _get(ctx, paper)
        if final.get("status") != "approved":
            raise RuntimeError(f"finished as {final.get('status')}")
        ctx.report.add(Step(name, "pass"))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)


def admin_edit(ctx: RunContext, paper: Paper) -> None:
    name = f"admin edit {paper.key}"
    try:
        before = _get(ctx, paper)
        body = {key: value for key, value in paper.payload.items() if key != "event_id"}
        body["activity_details"] = {**body["activity_details"], "description": body["activity_details"]["description"] + " Edited."}
        ctx.admin.request(
            "PUT",
            f"/admins/events/{paper.event_id}/submissions/{paper.submission_id}",
            body,
        )
        after = _get(ctx, paper)
        if after.get("signatory_sequence") != before.get("signatory_sequence"):
            raise RuntimeError("admin edit changed the lineup")
        if after.get("current_signatory") != before.get("current_signatory"):
            raise RuntimeError("admin edit moved the desk")
        ctx.report.add(Step(name, "pass", "lineup unchanged"))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)


def _extra_paper(ctx: RunContext, key: str, activity: str, dependents: list[str] | None = None) -> Paper:
    payload = saaf_body(
        event_id=str(uuid.uuid4()),
        title=key,
        activity_type=activity,
        event_date=ctx.date_key,
        day_name=ctx.day_name,
        venue="Online",
        has_reservation=False,
        dependents=dependents,
        email=ctx.accounts["orgA"]["email"],
        student_number="2026100101",
    )
    created = ctx.client("orgA").request("POST", "/students/submissions", payload)
    ctx.manifest.add_id(created.get("event_id"))
    ctx.manifest.add_id(created.get("submission_id"))
    paper = Paper(
        key,
        created["event_id"],
        created["submission_id"],
        "orgA",
        list(created.get("signatory_sequence") or []),
        payload,
        key,
    )
    ctx.papers[key] = paper
    return paper


def routing_changes(ctx: RunContext) -> None:
    name = "resubmit extra-curricular restarts at adviser"
    try:
        paper = _extra_paper(ctx, "route-dean", "co-curricular")
        _act(ctx, paper, ctx.ids["adv1"], "approve")
        _act(ctx, paper, ctx.ids["dean1"], "return", {"comment": "Change the activity type."})
        payload = {key: value for key, value in paper.payload.items() if key != "event_id"}
        payload["activity_classification"] = {"activity_type": "extra-curricular", "total_org_members": 40}
        _put(ctx, paper, payload)
        current = _get(ctx, paper).get("current_signatory")
        if current != ctx.ids["adv1"]:
            raise RuntimeError(f"resumed at {current}, expected the adviser")
        ctx.report.add(Step(name, "pass"))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)

    gap = "resubmit at OSAAR with a new collaborator"
    try:
        paper = _extra_paper(ctx, "route-osaar", "extra-curricular")
        _act(ctx, paper, ctx.ids["adv1"], "approve")
        _act(ctx, paper, ctx.ids["osaar1"], "return", {"comment": "Add the collaborator."})
        payload = {key: value for key, value in paper.payload.items() if key != "event_id"}
        payload["collaboration"] = {"dependent_organization_ids": [ctx.ids["orgB"]]}
        _put(ctx, paper, payload)
        current = _get(ctx, paper).get("current_signatory")
        if current == ctx.ids["osaar1"]:
            ctx.report.add(Step(gap, "gap", "resumed at OSAAR, so the new adviser was skipped", gap=True))
        elif current == ctx.ids["adv2"]:
            ctx.report.add(Step(gap, "pass", "restarted at the new collaborator adviser"))
        else:
            ctx.report.add(Step(gap, "gap", f"resumed at {current}", gap=True))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, gap, error)


def conflict(ctx: RunContext) -> None:
    paper = ctx.papers.get("P14")
    if not paper:
        return
    name = "final approval blocked by CDM hold"
    try:
        held = ctx.client("cdm1").request(
            "POST",
            f"/admins/campuses/{ctx.ids['campus']}/reservables/{ctx.ids['classroom']}/bookings",
            {"selections": [{"date": ctx.date_key, "slots": [3]}], "reason": "Hold for the conflict paper"},
        )
        ctx.manifest.add_id(held.get("booking_id"))
        for signatory_id in paper.lineup:
            if signatory_id == ctx.ids["cdm1"]:
                status, body = ctx.client("cdm1").call(
                    "POST",
                    f"/signatories/events/{paper.event_id}/submissions/{paper.submission_id}/approve",
                )
                if status != 409:
                    raise RuntimeError(f"expected 409, got {status}: {body}")
                ctx.report.add(Step(name, "pass", "409 at CDM", status))
                return
            _act(ctx, paper, signatory_id, "approve")
        raise RuntimeError("CDM was not in the lineup")
    except (ApiError, RuntimeError) as error:
        _fail(ctx, name, error)


def run(ctx: RunContext) -> None:
    if "P1" in ctx.papers:
        admin_edit(ctx, ctx.papers["P1"])
    for key in ("P1", "P2", "P3", "P6", "P7"):
        if key in ctx.papers:
            approve_all(ctx, ctx.papers[key])
    if "P5" in ctx.papers:
        return_then_approve(ctx, ctx.papers["P5"])
    if "P4" in ctx.papers:
        return_then_approve(ctx, ctx.papers["P4"])
    denies = [("P9", "adv1"), ("P10", "dean1"), ("P11", "osaar1"), ("P12", "osaar2"), ("P13", "cdm1")]
    for key, desk in denies:
        if key in ctx.papers:
            deny_at(ctx, ctx.papers[key], desk)
    routing_changes(ctx)
    conflict(ctx)
