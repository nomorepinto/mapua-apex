import { test } from "@playwright/test"

import { ReservablesPage } from "../pages/reservables.page"
import { openApex } from "../support/auth"
import { eventDate } from "../support/env"
import { readRun } from "../support/run-state"
import { captureJson } from "../support/ui"

test("reviewer adds rooms and equipment, then holds and releases a slot", async ({ browser }) => {
  const run = readRun()
  const session = await openApex(browser, "cdm1")
  const reservables = new ReservablesPage(session.page)
  try {
    await captureJson(session.page, "/reservables", "POST", () =>
      reservables.addRoom(run.campus, "R101", "10", "80", true),
    )
    await captureJson(session.page, "/reservables", "POST", () =>
      reservables.addRoom(run.campus, "Auditorium", "20", "200", false),
    )
    await captureJson(session.page, "/reservables", "POST", () =>
      reservables.addEquipment(run.campus, "Projector", "4"),
    )
    await reservables.expectListed(run.campus, "R101")
    await captureJson(session.page, "/bookings", "POST", () =>
      reservables.holdAndRelease(run.campus, "Auditorium", eventDate, 11),
    )
  } finally {
    await session.close()
  }
})
