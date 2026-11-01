"""OSAAR setup: campus, signatories, organizations, approval stages, account links."""

from __future__ import annotations

from apex_client import ApiError
from cleanup import snapshot_settings
from phases.context import RunContext
from report import Step


ROLES = {
    "adv1": ("adviser", None),
    "adv2": ("adviser", None),
    "adv3": ("adviser", None),
    "dean1": ("dean", "SOIT"),
    "dean2": ("dean", "SOE"),
    "osaar1": ("osaar", None),
    "osaar2": ("osaar", None),
    "cdm1": ("cdm", None),
}

NAMES = {
    "adv1": "Adviser Alpha",
    "adv2": "Adviser Bravo",
    "adv3": "Adviser Charlie",
    "dean1": "Dean Sierra",
    "dean2": "Dean Echo",
    "osaar1": "Osaar One",
    "osaar2": "Osaar Two",
    "cdm1": "Cdm Reviewer",
}


def _step(ctx: RunContext, name: str, action) -> bool:
    try:
        detail = action() or ""
        ctx.report.add(Step(name, "pass", detail))
        return True
    except ApiError as error:
        ctx.report.add(Step(name, "fail", str(error), error.status))
    except Exception as error:
        ctx.report.add(Step(name, "fail", str(error)))
    if not ctx.keep_going:
        raise SystemExit(1)
    return False


def run(ctx: RunContext) -> None:
    admin = ctx.admin
    tag = ctx.tag
    snapshot_settings(ctx.settings, ctx.manifest)

    def campus() -> str:
        created = admin.request(
            "POST",
            "/admins/campuses",
            {
                "name": f"Campus {tag}",
                "classroom_name_prefixes": ["R"],
                "classroom_name_digits": 3,
            },
        )
        campus_id = created["campus_id"]
        ctx.ids["campus"] = campus_id
        ctx.manifest.add_id(campus_id)
        status, body = admin.call(
            "POST",
            "/admins/campuses",
            {"name": f"Campus Half {tag}", "classroom_name_prefixes": ["R"]},
        )
        if status < 400:
            extra = body.get("campus_id") if isinstance(body, dict) else None
            ctx.manifest.add_id(extra)
            raise RuntimeError("A campus with only prefixes was accepted.")
        return campus_id

    if not _step(ctx, "setup campus", campus):
        return

    def signatories() -> str:
        existing = admin.request("GET", "/admins/signatories") or []
        preexisting = next((row for row in existing if str(row.get("role", "")).lower() == "cdm"), None)
        for key, (role, department) in ROLES.items():
            if role == "cdm" and preexisting:
                ctx.ids[key] = preexisting["signatory_id"]
                ctx.manifest.data["preexisting_cdm_id"] = preexisting["signatory_id"]
                holder = next(
                    (
                        account
                        for account in (admin.request("GET", "/admins/accounts") or [])
                        if account.get("signatory_id") == preexisting["signatory_id"]
                    ),
                    None,
                )
                ctx.manifest.data["preexisting_cdm_holder"] = holder.get("username") if holder else None
                ctx.manifest.save()
                continue
            body = {"name": f"{NAMES[key]} {tag}", "role": role}
            if department:
                body["department"] = department
            created = admin.request("POST", "/admins/signatories", body)
            ctx.ids[key] = created["signatory_id"]
            ctx.manifest.add_id(created["signatory_id"])
            ctx.manifest.data["created_signatory_ids"].append(created["signatory_id"])
            ctx.manifest.save()
        return "cdm reused" if preexisting else "cdm created"

    if not _step(ctx, "setup signatories", signatories):
        return

    def organizations() -> str:
        desks = {
            "orgA": [
                {"role": "adviser", "signatory_id": ctx.ids["adv1"]},
                {"role": "dean", "signatory_id": ctx.ids["dean1"]},
                {"role": "cdm", "signatory_id": ctx.ids["cdm1"]},
            ],
            "orgB": [
                {"role": "adviser", "signatory_id": ctx.ids["adv2"]},
                {"role": "dean", "signatory_id": ctx.ids["dean2"]},
                {"role": "cdm", "signatory_id": ctx.ids["cdm1"]},
            ],
            "orgC": [
                {"role": "adviser", "signatory_id": ctx.ids["adv3"]},
                {"role": "cdm", "signatory_id": ctx.ids["cdm1"]},
            ],
        }
        labels = {"orgA": "Org Alpha", "orgB": "Org Bravo", "orgC": "Org Charlie"}
        for key, signatories in desks.items():
            created = admin.request(
                "POST",
                "/admins/organizations",
                {
                    "name": f"{labels[key]} {tag}",
                    "is_higher_council": key == "orgC",
                    "signatories": signatories,
                },
            )
            ctx.ids[key] = created["organization_id"]
            ctx.manifest.add_id(created["organization_id"])
            ctx.manifest.data["created_org_ids"].append(created["organization_id"])
            ctx.manifest.save()
        return "three organizations"

    if not _step(ctx, "setup organizations", organizations):
        return

    def stages() -> str:
        admin.request(
            "PUT",
            "/admins/approval-settings",
            {"osaar_stage_signatory_ids": [ctx.ids["osaar1"], ctx.ids["osaar2"]]},
        )
        return "osaar1 then osaar2"

    if not _step(ctx, "setup approval stages", stages):
        return

    def links() -> str:
        accounts = admin.request("GET", "/admins/accounts") or []
        by_email = {str(account.get("email", "")).lower(): account for account in accounts}
        status, body = admin.call(
            "PUT",
            f"/admins/signatories/{ctx.ids['adv1']}/account",
            {"username": by_email.get(ctx.accounts["admin"]["email"].lower(), {}).get("username")},
        )
        if status != 422:
            raise RuntimeError(f"Linking the admin account returned {status}: {body}")
        for key in ("adv1", "adv2", "adv3", "dean1", "dean2", "osaar1", "osaar2", "cdm1"):
            username = by_email[ctx.accounts[key]["email"].lower()]["username"]
            admin.request("PUT", f"/admins/signatories/{ctx.ids[key]}/account", {"username": username})
        for key in ("orgA", "orgB", "orgC"):
            username = by_email[ctx.accounts[key]["email"].lower()]["username"]
            admin.request("PUT", f"/admins/organizations/{ctx.ids[key]}/account", {"username": username})
        ctx.clients.clear()
        return "desk and organization accounts linked"

    _step(ctx, "setup account links", links)
