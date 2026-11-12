import { expect, type Page } from "@playwright/test"

import { choose } from "../support/ui"

/**
 * Reports & Export (`/admin/reports`, `/osaar/reports`). Reports are generated
 * entirely in the browser from a date-scoped collection fetch, so nothing here
 * writes to the run manifest — the spec only previews and downloads. The
 * Session log report type is offered only to callers who can view the session
 * log (admin), which is how the OSAAR gating is asserted.
 */
export class ReportsPage {
  constructor(private readonly page: Page) {}

  async open(path: string) {
    await this.page.goto(path)
    await expect(this.page.getByRole("heading", { name: /Reports & Export/ })).toBeVisible()
  }

  /** The ever-present site footer carries the bug-report mailto entry point. */
  async expectBugReportFooter() {
    const link = this.page.getByRole("link", { name: "mapuaapex@gmail.com" })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "mailto:mapuaapex@gmail.com")
  }

  /** Titles of the report types offered by the "Report type" selector. */
  async availableReportTitles(): Promise<string[]> {
    const trigger = this.page.getByRole("combobox", { name: "Report type" })
    await trigger.click()
    const titles = await this.page
      .getByRole("listbox")
      .last()
      .getByRole("option")
      .allTextContents()
    await this.page.keyboard.press("Escape")
    return titles.map((title) => title.trim())
  }

  /** Choose a report type by its visible title and build a non-empty preview. */
  async preview(title: string) {
    await choose(this.page, this.page.getByRole("combobox", { name: "Report type" }), title)
    const preview = this.page.getByRole("button", { name: "Preview report" })
    await expect(preview).toBeEnabled()
    await preview.click()
    const panel = this.page.getByRole("region", { name: "Report preview" })
    await expect(panel).toBeVisible()
    await expect(panel.getByText("matching records")).toBeVisible()
    await expect(this.page.getByRole("button", { name: "Refresh preview" })).toBeVisible()
  }

  /** Preview may require acknowledging incomplete coverage before downloads unlock. */
  private async unlockDownloads() {
    const acknowledge = this.page.getByText("I acknowledge the coverage limits")
    if (await acknowledge.isVisible().catch(() => false)) await acknowledge.click()
  }

  /** Download the summary CSV and assert Playwright captured the browser-generated file. */
  async downloadSummaryCsv(typeSlug: string) {
    await this.unlockDownloads()
    const summary = this.page.getByRole("button", { name: "Summary CSV" })
    await expect(summary).toBeEnabled({ timeout: 30_000 })
    const pending = this.page.waitForEvent("download")
    await summary.click()
    const download = await pending
    expect(download.suggestedFilename()).toContain(typeSlug)
    expect(download.suggestedFilename()).toMatch(/\.summary\.csv$/)
  }

  /**
   * The Proposal statistics summary always carries the per-desk turnaround
   * cards, so their labels are present even before any desk time is recorded.
   */
  async expectTurnaroundSummary() {
    const preview = this.page.getByRole("region", { name: "Report preview" })
    await expect(preview.getByText("Median CDM desk time (working minutes)")).toBeVisible()
    await expect(preview.getByText("Median overall turnaround (working minutes)")).toBeVisible()
  }

  /**
   * Tick exportable columns in the "Export columns and appendices" picker. Each
   * change invalidates the preview, so the caller must refresh before downloading.
   */
  async selectColumns(labels: string[]) {
    const search = this.page.getByLabel("Search Export columns and appendices")
    for (const label of labels) {
      await search.fill(label)
      const option = this.page.getByText(label, { exact: true })
      await expect(option).toBeVisible()
      await option.click()
    }
    await search.fill("")
  }

  /** Re-run the report after a content change so the downloads unlock again. */
  async refreshPreview() {
    const refresh = this.page.getByRole("button", { name: "Refresh preview" })
    await expect(refresh).toBeEnabled()
    await refresh.click()
    const panel = this.page.getByRole("region", { name: "Report preview" })
    await expect(panel).toBeVisible()
    await expect(panel.getByText("matching records")).toBeVisible()
  }

  /** Download the detail-row CSV and assert Playwright captured the local file. */
  async downloadDetailsCsv(typeSlug: string) {
    await this.unlockDownloads()
    const details = this.page.getByRole("button", { name: "Detail CSV" })
    await expect(details).toBeEnabled({ timeout: 30_000 })
    const pending = this.page.waitForEvent("download")
    await details.click()
    const download = await pending
    expect(download.suggestedFilename()).toContain(typeSlug)
    expect(download.suggestedFilename()).toMatch(/\.details\.csv$/)
  }
}
