"""CDM reservables and the manual hold used by the conflict paper."""

from __future__ import annotations

from apex_client import ApiError
from fixtures import open_schedule
from phases.context import RunContext
from report import Step


def run(ctx: RunContext) -> None:
    cdm = ctx.client("cdm1")
    campus = ctx.ids["campus"]
    schedule = open_schedule()

    def create(name: str, kind: str, **extra) -> str:
        created = cdm.request(
            "POST",
            f"/admins/campuses/{campus}/reservables",
            {"name": name, "type": kind, "schedule": schedule, **extra},
        )
        reservable_id = created["reservable_id"]
        ctx.manifest.add_id(reservable_id)
        return reservable_id

    try:
        ctx.ids["classroom"] = create(f"R101", "room", min_participants=10, max_participants=80, is_classroom=True)
        ctx.ids["auditorium"] = create("Auditorium", "room", min_participants=20, max_participants=200)
        ctx.ids["projector"] = create("Projector", "equipment", max_quantity=4)
        cdm.request(
            "GET",
            f"/admins/campuses/{campus}/reservables/{ctx.ids['classroom']}/availability",
            params={"start": ctx.date_key, "end": ctx.date_key},
        )
        released = cdm.request(
            "POST",
            f"/admins/campuses/{campus}/reservables/{ctx.ids['auditorium']}/bookings",
            {"selections": [{"date": ctx.date_key, "slots": [11]}], "reason": "Hold that this run releases"},
        )
        release_id = released.get("booking_id")
        ctx.manifest.add_id(release_id)
        cdm.request(
            "DELETE",
            f"/admins/campuses/{campus}/reservables/{ctx.ids['auditorium']}/bookings/{release_id}",
        )
        ctx.report.add(Step("cdm reservables and holds", "pass"))
    except ApiError as error:
        ctx.report.add(Step("cdm reservables and holds", "fail", str(error), error.status))
        if not ctx.keep_going:
            raise SystemExit(1)
