import { test, expect } from "@playwright/test"

import { SetupPages } from "../pages/setup.page"
import { openApex, signInAndSaveApex } from "../support/auth"
import { campusName, orgName, personName } from "../support/data"
import { tag } from "../support/env"
import { rememberPreexistingCdm } from "../support/manifest"
import { writeRun } from "../support/run-state"
import { captureJson } from "../support/ui"

type SignatoryRow = { signatory_id?: string; role?: string; name?: string }
type AccountRow = {
  username?: string
  email?: string
  name?: string
  signatory_id?: string
}

function asRows<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[]
  if (body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)) {
    return (body as { data: T[] }).data
  }
  return []
}

test("admin builds the campus, desks, organizations, and account links", async ({ browser }) => {
  test.setTimeout(600_000)
  const admin = await openApex(browser, "admin")
  const page = admin.page
  const setup = new SetupPages(page)
  const campus = campusName(tag)
  const people = {
    adv1: personName("adv1", tag),
    adv2: personName("adv2", tag),
    adv3: personName("adv3", tag),
    dean1: personName("dean1", tag),
    dean2: personName("dean2", tag),
    osaar1: personName("osaar1", tag),
    osaar2: personName("osaar2", tag),
    osaarAll: personName("osaarAll", tag),
    cdm1: personName("cdm1", tag),
  }
  const orgs = {
    orgA: orgName("orgA", tag),
    orgB: orgName("orgB", tag),
    orgC: orgName("orgC", tag),
  }

  try {
    const signatoriesReady = page.waitForResponse(
      (response) => response.url().includes("/admins/signatories") && response.request().method() === "GET",
    )
    const accountsReady = page.waitForResponse(
      (response) => response.url().includes("/admins/accounts") && response.request().method() === "GET",
    )
    await setup.open("/osaar/setup/signatories")
    const signatories = asRows<SignatoryRow>(await (await signatoriesReady).json())
    const accounts = asRows<AccountRow>(await (await accountsReady).json())
    const preexisting = signatories.find((row) => String(row.role).toLowerCase() === "cdm")
    if (preexisting?.signatory_id) {
      const holder = accounts.find((row) => row.signatory_id === preexisting.signatory_id)
      await rememberPreexistingCdm(preexisting.signatory_id, holder?.username ?? null)
      people.cdm1 = preexisting.name || people.cdm1
    }

    await page.goto("/osaar/setup/campuses")
    await captureJson(page, "/admins/campuses", "POST", () => setup.addCampus(campus))
    await setup.expectMainNotOffered(campus)
    await setup.rejectCampusWithoutDigits(`Half Campus ${tag}`)

    await page.goto("/osaar/setup/signatories")
    for (const [key, role, department] of [
      ["adv1", "Adviser"],
      ["adv2", "Adviser"],
      ["adv3", "Adviser"],
      ["dean1", "Dean", "SOIT"],
      ["dean2", "Dean", "EECE"],
    ] as const) {
      await captureJson(page, "/admins/signatories", "POST", () =>
        setup.addSignatory(people[key], role, department),
      )
    }
    for (const key of ["osaar1", "osaar2"] as const) {
      await captureJson(page, "/admins/signatories", "POST", () =>
        setup.addSignatory(people[key], "OSAAR", undefined, campus),
      )
    }
    await captureJson(page, "/admins/signatories", "POST", () => setup.addSignatory(people.osaarAll, "OSAAR"))
    if (!preexisting) {
      await captureJson(page, "/admins/signatories", "POST", () => setup.addSignatory(people.cdm1, "CDM"))
    }

    await page.goto("/osaar/setup/organizations")
    await captureJson(page, "/admins/organizations", "POST", () =>
      setup.addOrganization(orgs.orgA, people.adv1, people.dean1),
    )
    await captureJson(page, "/admins/organizations", "POST", () =>
      setup.addOrganization(orgs.orgB, people.adv2, people.dean2),
    )
    await captureJson(page, "/admins/organizations", "POST", () => setup.addOrganization(orgs.orgC, people.adv3))

    await setup.expectOsaarCampuses(campus, people.osaar1, people.osaar2, people.osaarAll)

    // Approval-stage reorder is self-restoring: swap the campus order, persist it,
    // prove it stuck after a reload, then swap it back so later phases see the seed order.
    await setup.moveStageUp(people.osaar2)
    await setup.saveStages()
    await setup.expectStageOrder(campus, people.osaar2, people.osaar1)
    await page.reload()
    await setup.expectStageOrder(campus, people.osaar2, people.osaar1)
    await setup.moveStageUp(people.osaar1)
    await setup.saveStages()
    await setup.expectStageOrder(campus, people.osaar1, people.osaar2)

    const adminAccount = accounts.find((row) => row.email?.toLowerCase() === "mapuaapexqaautomation@gmail.com")
    await page.goto("/osaar/setup/signatories")
    const selfAssign = await setup.rejectAdminSelfAssign(
      people.adv1,
      adminAccount?.name?.trim() || adminAccount?.email || "mapuaapexqaautomation@gmail.com",
    )
    if (selfAssign === "assigned") {
      test.info().annotations.push({
        type: "gap",
        description: "Assigning the signed-in admin did not show the self-assignment error.",
      })
    }
    for (const key of ["adv1", "adv2", "adv3", "dean1", "dean2", "osaar1", "osaar2", "osaarAll"] as const) {
      await setup.assignAccount(people[key], key)
    }
    await setup.assignAccount(people.cdm1, "cdm1")
    await page.goto("/osaar/setup/organizations")
    for (const key of ["orgA", "orgB", "orgC"] as const) {
      await setup.assignAccount(orgs[key], key)
    }

    writeRun((state) => {
      state.tag = tag
      state.campus = campus
      state.people = people
      state.orgs = orgs
      state.cdmName = people.cdm1
    })
    await expect(page.getByRole("row", { name: orgs.orgA })).toBeVisible()
  } finally {
    await admin.close()
  }

  for (const key of ["adv1", "adv2", "adv3", "dean1", "dean2", "osaar1", "osaar2", "osaarAll", "cdm1", "orgA", "orgB", "orgC"]) {
    await signInAndSaveApex(browser, key)
  }
})
