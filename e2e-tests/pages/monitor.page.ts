import { expect, type Page } from "@playwright/test"

/**
 * Log monitors. The Activity Log page (`AdminMonitorActivitiesPage`) is reused
 * across `/admin/activities`, `/osaar/activities`, and `/cdm/activities`; the
 * Session Log is shared by `/admin/sessions` and `/osaar/sessions`. Gating is enforced by route
 * `AuthGuard`s — a wrong group renders an "Access Denied" panel, not a 403.
 */
export class MonitorPage {
  constructor(private readonly page: Page) {}

  async openActivityLog(path: string) {
    await this.page.goto(path)
    await expect(this.page.getByRole("heading", { name: /Activity Log/ })).toBeVisible()
  }

  async openSessionLog(path = "/admin/sessions") {
    await this.page.goto(path)
    await expect(this.page.getByRole("heading", { name: /Session Log/ })).toBeVisible()
  }

  /** The activity/session tables render one row per record in `table tbody tr`. */
  async expectRows() {
    // While the query is in flight the table shows animated skeleton rows that
    // carry no text; require a real record so the assertion isn't satisfied by
    // the loading state.
    const row = this.page.locator("table tbody tr").first()
    await expect(row).toBeVisible()
    await expect(row).not.toHaveText("")
  }

  /** Clicking an activity row opens its read-only detail modal. */
  async openFirstActivityDetail() {
    // Wait for the load to settle before clicking: the Refresh control is
    // disabled and labelled "Refreshing…" while the query is fetching, and a
    // row that re-renders into a skeleton under the pointer swallows the click
    // so the detail modal never opens.
    await expect(this.page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled()
    const row = this.page.locator("table tbody tr").first()
    await expect(row).toBeVisible()
    // The row is wider than the viewport (its trailing columns are clipped by
    // the card), so clicking the row's geometric center lands off the visible
    // area and misses the row's onClick. Click the always-visible first cell,
    // which bubbles the activation up to the row handler.
    await row.locator("td").first().click()
    await expect(this.page.getByText("Activity Log Record Details")).toBeVisible()
    await this.page.getByRole("button", { name: "Close Modal" }).click()
  }

  async expectAccessDenied() {
    await expect(this.page.getByRole("heading", { name: "Access Denied" })).toBeVisible()
    await expect(this.page.getByText("You do not have permission to view this page.")).toBeVisible()
  }
}
