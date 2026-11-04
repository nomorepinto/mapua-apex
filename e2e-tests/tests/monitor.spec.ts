import { test } from "@playwright/test"

import { MonitorPage } from "../pages/monitor.page"
import { openApex } from "../support/auth"

test("the log monitors list records and gate by group", async ({ browser }) => {
  test.setTimeout(300_000)

  // Admin sees both monitors and the activity detail modal.
  const admin = await openApex(browser, "admin")
  const adminMonitor = new MonitorPage(admin.page)
  try {
    await adminMonitor.openActivityLog("/admin/activities")
    await adminMonitor.expectRows()
    await adminMonitor.openFirstActivityDetail()
    await adminMonitor.openSessionLog()
    await adminMonitor.expectRows()
  } finally {
    await admin.close()
  }

  // OSAAR and CDM reviewers reach the shared Activity Log; the Session Log is admin-only.
  const osaar = await openApex(browser, "osaar1")
  try {
    await new MonitorPage(osaar.page).openActivityLog("/osaar/activities")
  } finally {
    await osaar.close()
  }

  const cdm = await openApex(browser, "cdm1")
  try {
    await new MonitorPage(cdm.page).openActivityLog("/cdm/activities")
  } finally {
    await cdm.close()
  }

  // An organization account is outside every log-viewing group.
  const org = await openApex(browser, "orgA")
  const orgMonitor = new MonitorPage(org.page)
  try {
    await org.page.goto("/admin/sessions")
    await orgMonitor.expectAccessDenied()
    await org.page.goto("/admin/activities")
    await orgMonitor.expectAccessDenied()
  } finally {
    await org.close()
  }
})
