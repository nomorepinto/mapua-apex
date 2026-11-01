"""Repeatable APEX and Arcus end-to-end runner.

`python run_e2e.py bootstrap` creates the test Cognito users once.
`python run_e2e.py` starts Nest, Vite, and both Arcus apps when they are not already up,
runs every phase, deletes the DynamoDB items it created, and stops the apps it started.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime

from apex_client import ApiError, ApexClient, Cognito
from cleanup import (
    all_state_manifests,
    cleanup_manifests,
    clear_student_attributes,
    leftover_count,
    release_test_groups,
    restore_settings,
)
from config import ACCOUNTS_PATH, ADMIN_FILE, REPORTS_DIR, STATE_DIR, Settings, load_settings
from fixtures import ACCOUNT_KEYS, ORG_KEYS, PLUS_TAG, SHARED_PASSWORD, SIGNATORY_KEYS, STUDENT_KEYS, run_tag
from manifest import Manifest
from phases import arcus, cdm, postevals, preflight, reservation_changes, reviews, setup, submissions
from phases.context import RunContext
from report import Report, Step
from servers import StartedServers


def _read_admin() -> tuple[str, str]:
    if not ADMIN_FILE.is_file():
        raise SystemExit(f"Missing admin credentials file at {ADMIN_FILE.name}.")
    found = {}
    for line in ADMIN_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            found[key.strip()] = value.strip()
    email = found.get("USERNAME") or found.get("EMAIL")
    password = found.get("PASSWORD")
    if not email or not password:
        raise SystemExit("The admin file needs USERNAME and PASSWORD.")
    return email, password


def _plus(base: str, key: str) -> str:
    local, domain = base.split("@", 1)
    return f"{local}+{PLUS_TAG}-{key}@{domain}"


def _load_accounts() -> dict:
    if not ACCOUNTS_PATH.is_file():
        raise SystemExit("No accounts.local.json. Run: python run_e2e.py bootstrap")
    return json.loads(ACCOUNTS_PATH.read_text(encoding="utf-8"))["accounts"]


def _needs_confirmation(error: ApiError) -> bool:
    code = str(error.body.get("code", ""))
    text = str(error)
    return code == "UserNotConfirmedException" or "not confirmed" in text.lower()


def bootstrap(settings: Settings) -> None:
    admin_email, admin_password = _read_admin()
    cognito = Cognito(settings)
    accounts = {"admin": {"email": admin_email, "password": admin_password}}
    pending: list[str] = []
    for key in ACCOUNT_KEYS:
        if key == "admin":
            continue
        email = _plus(admin_email, key)
        accounts[key] = {"email": email, "password": SHARED_PASSWORD}
        try:
            cognito.sign_in(email, SHARED_PASSWORD)
            print(f"{key} already confirmed")
            continue
        except ApiError as error:
            if _needs_confirmation(error):
                try:
                    cognito.resend(email)
                except ApiError:
                    pass
                pending.append(key)
                continue
        try:
            result = cognito.sign_up(email, SHARED_PASSWORD, key)
        except ApiError as error:
            if error.body.get("code") != "UsernameExistsException":
                raise
            pending.append(key)
            continue
        if result.get("UserConfirmed"):
            print(f"{key} confirmed by the pool")
            continue
        pending.append(key)
    ACCOUNTS_PATH.write_text(json.dumps({"accounts": accounts}, indent=2), encoding="utf-8")
    for key in pending:
        code = input(f"Confirmation code for {accounts[key]['email']}: ").strip()
        cognito.confirm(accounts[key]["email"], code)
        print(f"{key} confirmed")
    print(f"Wrote {ACCOUNTS_PATH.name}. Later runs do not prompt.")


def _unlink(ctx: RunContext) -> None:
    admin = ctx.admin
    if not admin.token:
        return
    for signatory_id in ctx.manifest.data.get("created_signatory_ids") or []:
        try:
            admin.request("PUT", f"/admins/signatories/{signatory_id}/account", {"username": None})
        except ApiError:
            continue
    for org_id in ctx.manifest.data.get("created_org_ids") or []:
        try:
            admin.request("PUT", f"/admins/organizations/{org_id}/account", {"username": None})
        except ApiError:
            continue
    cdm_id = ctx.manifest.data.get("preexisting_cdm_id")
    if cdm_id:
        try:
            admin.request(
                "PUT",
                f"/admins/signatories/{cdm_id}/account",
                {"username": ctx.manifest.data.get("preexisting_cdm_holder")},
            )
        except ApiError as error:
            ctx.report.add(Step("restore cdm holder", "fail", str(error), error.status))


def _parse_date(value: str | None) -> tuple[date, bool]:
    if not value:
        return date.today(), False
    chosen = datetime.strptime(value, "%Y-%m-%d").date()
    return chosen, chosen != date.today()


def run(args: argparse.Namespace) -> int:
    settings = load_settings()
    accounts = _load_accounts()
    tag = run_tag()
    event_date, skip_day_of = _parse_date(args.event_date)
    report = Report(tag)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = Manifest(STATE_DIR / f"manifest-{tag}.json")

    if not args.no_cleanup:
        previous = [item for item in all_state_manifests(STATE_DIR) if item.path != manifest.path]
        if previous:
            if args.dry_run_cleanup:
                cleanup_manifests(settings, previous, dry_run=True, force=args.force)
                return 0
            deleted, leftovers = cleanup_manifests(settings, previous, force=args.force)
            report.cleanup_before = deleted
            report.add(Step("cleanup before", "pass" if leftovers == 0 else "fail", f"deleted {deleted}, left {leftovers}"))
            if leftovers == 0:
                for item in previous:
                    item.path.unlink(missing_ok=True)
            elif not args.keep_going:
                report.leftovers = leftovers
                report.write(REPORTS_DIR / tag)
                return 1

    admin = ApexClient(settings, manifest)
    ctx = RunContext(
        settings=settings,
        report=report,
        manifest=manifest,
        tag=tag,
        event_date=event_date,
        skip_day_of=skip_day_of,
        admin=admin,
        accounts=accounts,
        keep_going=args.keep_going,
    )
    ctx.report_dir = REPORTS_DIR / tag
    code = 0
    try:
        preflight.run(ctx)
        admin_session = admin.login(accounts["admin"]["email"], accounts["admin"]["password"])
        manifest.add_account(admin_session["sub"], accounts["admin"]["email"])
        for key in SIGNATORY_KEYS + ORG_KEYS + STUDENT_KEYS:
            signed_in = ApexClient(settings, manifest)
            signed_in.login(accounts[key]["email"], accounts[key]["password"], start_session=False)
            manifest.add_account(signed_in.sub, accounts[key]["email"])
        ctx.clients.clear()
        admin.login(accounts["admin"]["email"], accounts["admin"]["password"])
        if args.phase in (None, "setup"):
            setup.run(ctx)
        if args.phase in (None, "cdm"):
            cdm.run(ctx)
        if args.phase in (None, "submissions"):
            submissions.run(ctx)
        if args.phase in (None, "reviews"):
            reviews.run(ctx)
        if args.phase in (None, "arcus"):
            arcus.run(ctx)
        if args.phase in (None, "postevals"):
            postevals.run(ctx)
        if args.phase in (None, "reservation_changes"):
            reservation_changes.run(ctx)
        if args.ui and args.phase is None:
            from ui_smoke import run as ui_run

            ui_run(ctx)
        report.add(Step("finished paper badge", "gap", "The API stores finished. The student badge maps that status to Pending.", gap=True))
        report.add(Step("student reservation change entry", "gap", "The suite files reservation changes through the API. No page calls that dialog.", gap=True))
        report.add(Step("stale reservation draft", "gap", "Choosing no on the start page does not clear reservation picks already stored in the draft.", gap=True))
    except SystemExit as exit_error:
        code = int(exit_error.code or 1)
    finally:
        if not args.no_cleanup and admin.token:
            _unlink(ctx)
            release_test_groups(
                settings,
                [accounts[key]["email"] for key in SIGNATORY_KEYS + ORG_KEYS + STUDENT_KEYS],
            )
            clear_student_attributes(settings, [accounts[key]["email"] for key in STUDENT_KEYS])
            try:
                restore_settings(settings, manifest)
            except Exception as error:
                report.add(Step("restore approval settings", "fail", str(error)))
                code = code or 1
            deleted, leftovers = cleanup_manifests(settings, [manifest], force=args.force, restore=manifest)
            report.cleanup_after = deleted
            report.leftovers = leftovers
            report.add(Step("cleanup after", "pass" if leftovers == 0 else "fail", f"deleted {deleted}, left {leftovers}"))
            if leftovers == 0:
                manifest.path.unlink(missing_ok=True)
        elif not args.no_cleanup and not manifest.match_tokens:
            report.leftovers = 0
            report.add(Step("cleanup after", "pass", "No writes, so nothing to delete."))
            manifest.path.unlink(missing_ok=True)
        elif args.no_cleanup:
            report.leftovers = leftover_count(settings, [manifest])
        report.write(REPORTS_DIR / tag)
    if code:
        return code
    return 0 if report.passed() else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="APEX and Arcus end-to-end suite")
    parser.add_argument("command", nargs="?", default="run", choices=["run", "bootstrap", "cleanup"])
    parser.add_argument("--phase", choices=["setup", "cdm", "submissions", "reviews", "arcus", "postevals", "reservation_changes"])
    parser.add_argument("--ui", action="store_true")
    parser.add_argument("--event-date", help="YYYY-MM-DD. A date other than today skips Arcus and post-evals.")
    parser.add_argument("--keep-going", action="store_true")
    parser.add_argument("--no-cleanup", action="store_true")
    parser.add_argument("--dry-run-cleanup", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--no-servers", action="store_true", help="Do not start Nest, Vite, or the Arcus apps.")
    args = parser.parse_args()
    settings = load_settings()
    if args.command == "bootstrap":
        bootstrap(settings)
        return
    if args.command == "cleanup":
        deleted, leftovers = cleanup_manifests(
            settings,
            all_state_manifests(STATE_DIR),
            dry_run=args.dry_run_cleanup,
            force=args.force,
        )
        print(f"deleted {deleted}, leftovers {leftovers}")
        raise SystemExit(0 if leftovers == 0 or args.dry_run_cleanup else 1)
    if args.no_servers:
        raise SystemExit(run(args))
    started = StartedServers()
    code = 1
    try:
        started.start()
        code = run(args)
    except RuntimeError as error:
        print(error)
    finally:
        started.stop()
    raise SystemExit(code)


if __name__ == "__main__":
    main()
