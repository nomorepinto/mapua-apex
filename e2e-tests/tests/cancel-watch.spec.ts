import { expect, test } from "@playwright/test"

import { CancelWatchPage } from "../pages/cancel-watch.page"
import { DashboardPage } from "../pages/dashboard.page"
import { openApex } from "../support/auth"
import { readRun } from "../support/run-state"

test.describe.configure({ mode: "serial" })

// Cancellation is triggered on demand by the local-only route, not by a real
// event date, so — unlike the postevals project — this spec does NOT skip when
// the event is not "today". The kill-switch, however, is read from the same env
// the backend runs under, so the cancel/no-op steps defer to the disabled check.
const autoCancelDisabled = ["false", "0", "no", "off"].includes(
  (process.env.ARCUS_AUTO_CANCEL_ENABLED ?? "").trim().toLowerCase(),
)

async function expireAsAdmin(browser: import("@playwright/test").Browser, title: string) {
  const admin = await openApex(browser, "admin")
  try {
    // Mount a guarded admin route so the SPA opens an active session (business
    // routes return 428 without one), then drive the local-only expire trigger.
    await admin.page.goto("/osaar/dashboard/submissions")
    return await new CancelWatchPage(admin.page).expireByTitle(title)
  } finally {
    await admin.close()
  }
}

test("lapses an approved event with no post-eval into Cancelled", async ({ browser }) => {
  test.skip(autoCancelDisabled, "ARCUS_AUTO_CANCEL_ENABLED is off in this run")
  const paper = readRun().papers.P1
  expect(await expireAsAdmin(browser, paper.title)).toBe("cancelled")
  const student = await openApex(browser, paper.org)
  try {
    await new DashboardPage(student.page).expectBadge(paper.title, "Cancelled")
    await new CancelWatchPage(student.page).expectAutoCancelNotice(paper.title)
  } finally {
    await student.close()
  }
})

test("leaves an event alone once its post-eval is filed", async ({ browser }) => {
  test.skip(autoCancelDisabled, "ARCUS_AUTO_CANCEL_ENABLED is off in this run")
  const paper = readRun().papers.P15
  expect(await expireAsAdmin(browser, paper.title)).toBe("post-eval filed")
  const student = await openApex(browser, paper.org)
  try {
    await new DashboardPage(student.page).expectBadge(paper.title, "Approved")
  } finally {
    await student.close()
  }
})

test("does nothing while the kill-switch is off", async ({ browser }) => {
  test.skip(!autoCancelDisabled, "ARCUS_AUTO_CANCEL_ENABLED is on in the default run")
  const paper = readRun().papers.P1
  expect(await expireAsAdmin(browser, paper.title)).toBe("disabled")
  const student = await openApex(browser, paper.org)
  try {
    await new DashboardPage(student.page).expectBadge(paper.title, "Approved")
  } finally {
    await student.close()
  }
})
