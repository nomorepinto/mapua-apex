import { expect, type Page } from "@playwright/test"

/**
 * Calendar views. Every review desk renders the same `SubmissionCalendarSection`
 * (CDM uses its reservations variant) once the URL carries `?view=calendar`.
 * The event/submission basis toggle and the "Selected Date" panel only exist in
 * the calendar surface, so together they prove the desk switched out of the table.
 */
export class CalendarPage {
  constructor(private readonly page: Page) {}

  async openCalendar(path: string, title: string) {
    await this.page.goto(`${path}?view=calendar`)
    await expect(this.page.getByRole("heading", { name: title, exact: true })).toBeVisible()
    await expect(this.page.getByRole("button", { name: "Event Schedule" })).toBeVisible()
    await expect(this.page.getByText("Selected Date", { exact: true })).toBeVisible()
  }
}
