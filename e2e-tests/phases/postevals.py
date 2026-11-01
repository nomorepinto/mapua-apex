"""File post-evaluations and exercise OSAAR approve and deny. There is no return."""

from __future__ import annotations

from apex_client import ApiError
from fixtures import posteval_body
from phases.context import RunContext
from report import Step


def _fail(ctx: RunContext, name: str, error: Exception) -> None:
    status = error.status if isinstance(error, ApiError) else None
    ctx.report.add(Step(name, "fail", str(error), status))
    if not ctx.keep_going:
        raise SystemExit(1)


def _file(ctx: RunContext, org: str, paper) -> dict:
    created = ctx.client(org).request("POST", "/students/postevals", posteval_body(paper.event_id, paper.submission_id))
    posteval_id = created.get("posteval_id")
    ctx.manifest.add_id(posteval_id)
    return created


def run(ctx: RunContext) -> None:
    if ctx.skip_day_of:
        ctx.report.add(Step("postevals", "skip", "event date is not today"))
        return
    org = ctx.client("orgA")
    try:
        eligible = org.request("GET", "/students/postevals/events") or []
        eligible_ids = {row.get("event_id") for row in eligible}
        council_ids = {ctx.papers[key].event_id for key in ("P6", "P7") if key in ctx.papers}
        if council_ids & eligible_ids:
            raise RuntimeError(f"council events were eligible: {council_ids & eligible_ids}")
        ctx.report.add(Step("posteval eligibility excludes councils", "pass"))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, "posteval eligibility excludes councils", error)
        return

    p2 = ctx.papers.get("P2")
    p3 = ctx.papers.get("P3")
    if not p2 or not p3:
        _fail(ctx, "postevals", RuntimeError("P2 or P3 is missing"))
        return
    try:
        participants = org.request("GET", f"/students/events/{p2.event_id}/participants")
        filed = _file(ctx, "orgA", p2)
        snapshot = filed.get("participation_snapshot") or {}
        if snapshot.get("attendance_count") != participants.get("attendance_count"):
            raise RuntimeError(
                f"snapshot {snapshot.get('attendance_count')} != live {participants.get('attendance_count')}"
            )
        ctx.client("osaar1").request(
            "POST",
            f"/admins/postevals/{p2.event_id}/{filed['posteval_id']}/approve",
        )
        finished = org.request("GET", f"/students/events/{p2.event_id}/submissions/{p2.submission_id}")
        if finished.get("status") != "finished":
            raise RuntimeError(f"P2 status {finished.get('status')}")
        ctx.report.add(Step("approve P2 posteval", "pass", "submission finished"))
        denied = _file(ctx, "orgA", p3)
        ctx.client("osaar1").request(
            "POST",
            f"/admins/postevals/{p3.event_id}/{denied['posteval_id']}/deny",
        )
        refiled = _file(ctx, "orgA", p3)
        ctx.client("osaar1").request(
            "POST",
            f"/admins/postevals/{p3.event_id}/{refiled['posteval_id']}/approve",
        )
        ctx.report.add(Step("deny and refile P3 posteval", "pass"))
        status, _ = org.call("POST", "/students/postevals", posteval_body(p2.event_id, p2.submission_id))
        if status != 409:
            raise RuntimeError(f"duplicate posteval returned {status}")
        status, _ = ctx.client("osaar1").call(
            "POST",
            f"/admins/postevals/{p2.event_id}/{filed['posteval_id']}/deny",
        )
        if status != 422:
            raise RuntimeError(f"deny after approve returned {status}")
        status, _ = ctx.client("osaar1").call(
            "POST",
            f"/admins/postevals/{p2.event_id}/{filed['posteval_id']}/return",
        )
        if status not in (404, 405):
            raise RuntimeError(f"posteval return returned {status}")
        ctx.report.add(Step("posteval has no return", "pass", f"return status {status}", status))
    except (ApiError, RuntimeError) as error:
        _fail(ctx, "postevals", error)
