"""Fail before any write when the local environment cannot host the run."""

from __future__ import annotations

from datetime import date

import requests

from config import Settings
from report import Report, Step


def run(settings: Settings, report: Report, event_date: date, skip_day_of: bool) -> None:
    problems: list[str] = []
    if settings.app_env != "local":
        problems.append(f"APP_ENV is {settings.app_env or 'unset'}; same-day dates need APP_ENV=local.")
    if not settings.allow_any_event_date:
        problems.append("VITE_ALLOW_ANY_EVENT_DATE is not true.")
    if not settings.api_base.startswith("http://localhost:3000/api/v2"):
        problems.append(f"VITE_API_BASE_URL must be http://localhost:3000/api/v2 (got {settings.api_base or 'unset'}).")
    if event_date.strftime("%A") == "Sunday" and not skip_day_of:
        problems.append("The event date is a Sunday. Rooms cannot be booked and attendance is closed. Pass --event-date for a weekday to run setup and submissions only.")
    if not settings.table_name:
        problems.append("AWS_DYNAMODB_TABLE is unset.")
    if not settings.cognito_client_id:
        problems.append("VITE_COGNITO_CLIENT_ID is unset.")

    for label, url in (
        ("Nest", settings.api_base.rsplit("/api/v2", 1)[0] + "/api/v2/ping"),
        ("Vite", settings.frontend_base),
        ("Arcus Attendance", settings.attendance_base),
        ("Arcus Evaluation", settings.evaluation_base),
    ):
        try:
            response = requests.get(url, timeout=5)
            if response.status_code >= 500:
                problems.append(f"{label} returned {response.status_code}.")
        except requests.RequestException as error:
            problems.append(f"{label} is not reachable at {url}: {error.__class__.__name__}.")

    if problems:
        report.add(Step("preflight", "fail", "; ".join(problems)))
        raise SystemExit(2)
    report.add(Step("preflight", "pass", f"event date {event_date.isoformat()}"))
