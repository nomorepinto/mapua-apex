"""Optional browser checks. API coverage does not render these pages."""

from __future__ import annotations

import json
from urllib.parse import urlparse

from apex_client import Cognito
from phases.context import RunContext
from report import Step


def _install(page, settings, email: str, password: str) -> None:
    session = Cognito(settings).sign_in(email, password)
    import base64

    part = session["id_token"].split(".")[1]
    part += "=" * ((4 - len(part) % 4) % 4)
    profile = json.loads(base64.urlsafe_b64decode(part))
    storage = {
        "id_token": session["id_token"],
        "access_token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "token_type": "Bearer",
        "expires_in": session["expires_in"],
        "profile": profile,
        "expires_at": 4_102_444_800,
        "scope": "openid profile email",
    }
    authority = f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/{settings.cognito_pool_id}"
    key = f"oidc.user:{authority}:{settings.cognito_client_id}"
    page.add_init_script(
        """([storageKey, value]) => sessionStorage.setItem(storageKey, value)""",
        [key, json.dumps(storage)],
    )


def _shot(page, directory, name: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(directory / f"{name}.png"), full_page=True)


def run(ctx: RunContext) -> None:
    from playwright.sync_api import sync_playwright

    shots = ctx.report_dir if hasattr(ctx, "report_dir") else None
    base = ctx.settings.frontend_base
    checks = [
        ("admin", "/osaar/setup/organizations", "/osaar/setup/organizations"),
        ("admin", "/osaar/setup/signatories", "/osaar/setup/signatories"),
        ("admin", "/osaar/setup/approval-stages", "/osaar/setup/approval-stages"),
        ("admin", "/osaar/setup/campuses", "/osaar/setup/campuses"),
        ("cdm1", "/cdm/reservables/add", "/cdm/reservables/add"),
        ("cdm1", "/cdm/reservables/view", "/cdm/reservables/view"),
        ("cdm1", "/cdm/reservables/reserve", "/cdm/reservables/reserve"),
        ("cdm1", "/cdm/reservations", "/cdm/reservations"),
        ("osaar1", "/osaar/postevals", "/osaar/postevals"),
        ("admin", "/", "/admin/sessions"),
        ("osaar1", "/", "/osaar/dashboard"),
        ("cdm1", "/", "/cdm/dashboard"),
        ("dean1", "/", "/dean/dashboard"),
        ("adv1", "/", "/adviser/dashboard"),
        ("orgA", "/", "/students/dashboard"),
    ]
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for key, path, expected in checks:
                account = ctx.accounts[key]
                page = browser.new_page()
                _install(page, ctx.settings, account["email"], account["password"])
                page.goto(base + path, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                landed = urlparse(page.url).path
                if path == "/osaar/postevals":
                    returned = page.get_by_role("button", name="Return").count()
                    if returned:
                        ctx.report.add(Step("ui posteval return button", "fail", "Return is visible"))
                    else:
                        ctx.report.add(Step("ui posteval return button", "pass", "no Return button"))
                name = f"ui {key} {path}"
                if expected in landed or landed.startswith(expected):
                    ctx.report.add(Step(name, "pass", landed))
                else:
                    ctx.report.add(Step(name, "fail", f"landed on {landed}"))
                    if not ctx.keep_going:
                        browser.close()
                        raise SystemExit(1)
                if shots:
                    _shot(page, shots, name.replace("/", "-").replace(" ", "-"))
                page.close()
            browser.close()
    except SystemExit:
        raise
    except Exception as error:
        ctx.report.add(Step("ui smoke", "fail", str(error)))
        if not ctx.keep_going:
            raise SystemExit(1)
