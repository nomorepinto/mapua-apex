import { test } from "@playwright/test"

import { DashboardPage } from "../pages/dashboard.page"
import { ReservationDeskPage } from "../pages/reservation-desk.page"
import { openApex } from "../support/auth"
import { readRun } from "../support/run-state"
import { captureJson } from "../support/ui"

test("reschedule, deny, and cancel one approved reservation", async ({ browser }) => {
  test.setTimeout(300_000)
  const run = readRun()
  const paper = run.papers.P4
  const student = await openApex(browser, paper.org)
  try {
    await captureJson(student.page, "/reservation-change", "POST", () =>
      new DashboardPage(student.page).requestChange(paper.title, "Reschedule"),
    )
  } finally {
    await student.close()
  }

  const cdm = await openApex(browser, "cdm1")
  const desk = new ReservationDeskPage(cdm.page)
  try {
    await desk.open(run.campus, paper.title)
    await desk.reschedule(5)
  } finally {
    await cdm.close()
  }

  const second = await openApex(browser, paper.org)
  try {
    await captureJson(second.page, "/reservation-change", "POST", () =>
      new DashboardPage(second.page).requestChange(paper.title, "Reschedule"),
    )
  } finally {
    await second.close()
  }

  const deny = await openApex(browser, "cdm1")
  try {
    const denied = new ReservationDeskPage(deny.page)
    await denied.open(run.campus, paper.title)
    await denied.deny()
  } finally {
    await deny.close()
  }

  const cancel = await openApex(browser, paper.org)
  try {
    await captureJson(cancel.page, "/reservation-change", "POST", () =>
      new DashboardPage(cancel.page).requestChange(paper.title, "Cancel event"),
    )
  } finally {
    await cancel.close()
  }

  const finish = await openApex(browser, "cdm1")
  try {
    const closing = new ReservationDeskPage(finish.page)
    await closing.open(run.campus, paper.title)
    await closing.cancel()
  } finally {
    await finish.close()
  }

  const badge = await openApex(browser, paper.org)
  try {
    await new DashboardPage(badge.page).expectBadge(paper.title, "Cancelled")
  } finally {
    await badge.close()
  }
})
