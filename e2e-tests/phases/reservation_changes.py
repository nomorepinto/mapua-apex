"""Reschedule, deny, and cancel one approved reservation. Uses P4 so P2 stays approved."""

from __future__ import annotations

from apex_client import ApiError
from phases.context import RunContext
from report import Step


def _change(ctx: RunContext, paper, request_type: str) -> dict:
    return ctx.client(paper.org).request(
        "POST",
        f"/students/events/{paper.event_id}/submissions/{paper.submission_id}/reservation-change",
        {"request_type": request_type, "reason": f"E2E {request_type} request for this reservation."},
    )


def run(ctx: RunContext) -> None:
    paper = ctx.papers.get("P4")
    if not paper:
        ctx.report.add(Step("reservation changes", "fail", "P4 was not created"))
        if not ctx.keep_going:
            raise SystemExit(1)
        return
    cdm = ctx.client("cdm1")
    campus = ctx.ids["campus"]
    try:
        reschedule = _change(ctx, paper, "reschedule")
        ctx.manifest.add_id(reschedule.get("change_id"))
        bookings = []
        for hold in reschedule.get("bookings") or []:
            bookings.append(
                {
                    "pk": hold["pk"],
                    "sk": hold["sk"],
                    "action": "update",
                    "selections": [{"date": ctx.date_key, "slots": [5]}],
                }
            )
        cdm.request(
            "POST",
            f"/admins/campuses/{campus}/reservation-changes/{reschedule['change_id']}/resolve",
            {"decision": "reschedule", "bookings": bookings},
        )
        denied = _change(ctx, paper, "reschedule")
        ctx.manifest.add_id(denied.get("change_id"))
        cdm.request(
            "POST",
            f"/admins/campuses/{campus}/reservation-changes/{denied['change_id']}/resolve",
            {"decision": "deny", "comment": "The requested move is denied."},
        )
        cancelled = _change(ctx, paper, "cancel")
        ctx.manifest.add_id(cancelled.get("change_id"))
        cdm.request(
            "POST",
            f"/admins/campuses/{campus}/reservation-changes/{cancelled['change_id']}/resolve",
            {"decision": "cancel"},
        )
        final = ctx.client(paper.org).request(
            "GET",
            f"/students/events/{paper.event_id}/submissions/{paper.submission_id}",
        )
        if final.get("status") != "cancelled":
            raise RuntimeError(f"expected cancelled, got {final.get('status')}")
        ctx.report.add(Step("reservation changes on P4", "pass", "reschedule, deny, cancel"))
    except (ApiError, RuntimeError, KeyError) as error:
        status = error.status if isinstance(error, ApiError) else None
        ctx.report.add(Step("reservation changes on P4", "fail", str(error), status))
        if not ctx.keep_going:
            raise SystemExit(1)
