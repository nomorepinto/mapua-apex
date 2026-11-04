import { test } from "@playwright/test"

import { CalendarPage } from "../pages/calendar.page"
import { openApex } from "../support/auth"

test("every review desk switches to its calendar view", async ({ browser }) => {
  test.setTimeout(360_000)

  const osaar = await openApex(browser, "osaar1")
  const osaarCalendar = new CalendarPage(osaar.page)
  try {
    await osaarCalendar.openCalendar("/osaar/dashboard/submissions", "Applications Calendar")
    await osaarCalendar.openCalendar("/osaar/dashboard/review", "Review Calendar")
  } finally {
    await osaar.close()
  }

  const dean = await openApex(browser, "dean1")
  try {
    await new CalendarPage(dean.page).openCalendar("/dean/dashboard", "Calendar")
  } finally {
    await dean.close()
  }

  const adviser = await openApex(browser, "adv1")
  try {
    await new CalendarPage(adviser.page).openCalendar("/adviser/dashboard", "Calendar")
  } finally {
    await adviser.close()
  }

  const cdm = await openApex(browser, "cdm1")
  try {
    await new CalendarPage(cdm.page).openCalendar("/cdm/dashboard", "CDM Reservations Calendar")
  } finally {
    await cdm.close()
  }
})
