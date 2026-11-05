import { test, expect } from "@playwright/test"

import { ReportsPage } from "../pages/reports.page"
import { openApex } from "../support/auth"

const ADMIN_TITLES = [
  "Session log",
  "Activity log",
  "Proposal statistics",
  "Post-evaluation history",
  "Reservation-change history",
]

test("administrators build and export every report; OSAAR loses the session log", async ({
  browser,
}) => {
  test.setTimeout(420_000)

  const admin = await openApex(browser, "admin")
  const adminReports = new ReportsPage(admin.page)
  try {
    await adminReports.open("/admin/reports")
    await adminReports.expectBugReportFooter()
    const offered = await adminReports.availableReportTitles()
    for (const title of ADMIN_TITLES) await expect(offered).toContain(title)

    for (const title of ADMIN_TITLES) await adminReports.preview(title)

    await adminReports.preview("Activity log")
    await adminReports.downloadSummaryCsv("activity")
  } finally {
    await admin.close()
  }

  const osaar = await openApex(browser, "osaar1")
  const osaarReports = new ReportsPage(osaar.page)
  try {
    await osaarReports.open("/osaar/reports")
    const offered = await osaarReports.availableReportTitles()
    await expect(offered).not.toContain("Session log")
    for (const title of ADMIN_TITLES.filter((item) => item !== "Session log")) {
      await expect(offered).toContain(title)
    }
    await osaarReports.preview("Activity log")
  } finally {
    await osaar.close()
  }
})
