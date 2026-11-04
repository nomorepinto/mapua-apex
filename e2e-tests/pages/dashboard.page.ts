import { expect, type Page } from "@playwright/test"

import { PROSE } from "../support/data"

/**
 * The student dashboard renders several "Search records" toolbars (proposals,
 * post-evals). Narrow to the proposals panel so a locator is unambiguous.
 */
function proposalSearch(page: Page) {
  return page
    .getByRole("region", { name: "Proposal statistics filters" })
    .getByLabel("Search records")
}

/**
 * The proposals table row for a title. Scoped to a `<tr>` so the active-search
 * chip ("Search: {title}") that the toolbar renders — also role=button — never
 * collides with the row when narrowing by accessible name.
 */
function proposalRow(page: Page, title: string) {
  return page.locator("tr").filter({ hasText: title })
}

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async openProposal(title: string) {
    await this.page.goto("/students/dashboard")
    await proposalSearch(this.page).fill(title)
    await proposalRow(this.page, title).first().click()
    await expect(this.page.getByRole("dialog", { name: `${title} Proposal` })).toBeVisible()
  }

  async expectBadge(title: string, badge: string) {
    await this.page.goto("/students/dashboard")
    await proposalSearch(this.page).fill(title)
    await expect(proposalRow(this.page, title).first()).toContainText(badge)
  }

  async expectReturned(title: string) {
    await this.openProposal(title)
    await expect(this.page.getByText("Application Returned")).toBeVisible()
    await expect(this.page.getByRole("button", { name: "Edit and resubmit" }).first()).toBeVisible()
  }

  async editAndResubmit(title: string) {
    await this.expectReturned(title)
    await this.page.getByRole("button", { name: "Edit and resubmit" }).first().click()
    await expect(this.page).toHaveURL(/\/students\/submissions\/saaf/)
  }

  async expectDenied(title: string) {
    await this.openProposal(title)
    await expect(this.page.getByText("This submission was denied and cannot be edited.")).toBeVisible()
    await expect(this.page.getByRole("button", { name: "Edit and resubmit" })).toHaveCount(0)
    await this.page.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  }

  async requestChange(title: string, kind: "Reschedule" | "Cancel event") {
    await this.openProposal(title)
    await this.page.getByRole("button", { name: "Request a reservation change" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Request a reservation change" })
    await dialog.getByRole("radio", { name: kind }).check()
    await dialog.getByLabel(/Reason/).fill(
      kind === "Reschedule"
        ? "Please move this reservation to a later open slot in the same day."
        : "Please cancel this reservation. The organization will not use the room.",
    )
    await dialog.getByRole("button", { name: "Submit request" }).click()
    await expect(this.page.getByText("Request sent")).toBeVisible()
  }

  async currentReviewer(title: string): Promise<string> {
    await this.openProposal(title)
    const dialog = this.page.getByRole("dialog", { name: `${title} Proposal` })
    await dialog.getByRole("button", { name: "Milestone & Progress" }).click()
    const current = dialog.locator("span.text-amber-900")
    await expect(current.first()).toBeAttached()
    const name = (await current.allTextContents()).map((label) => label.trim()).find(Boolean) ?? ""
    await dialog.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
    return name
  }

  async expectDescription(title: string, text: string) {
    await this.openProposal(title)
    await expect(this.page.getByText(text)).toBeVisible()
    await this.page.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  }
}

export class AdminEditPage {
  constructor(private readonly page: Page) {}

  async appendDescription(title: string) {
    await this.page.goto("/osaar/dashboard/submissions")
    await this.page.getByLabel("Search submissions").fill(title)
    await this.page.getByRole("button", { name: title }).first().click()
    await this.page.getByRole("button", { name: "Edit submission" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Edit submission" })
    const description = dialog.getByPlaceholder(/comprehensive summary/)
    await description.fill(`${await description.inputValue()} Edited.`)
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expect(this.page.getByRole("dialog", { name: "Submission updated" })).toBeVisible()
  }
}

export const editedSentence = `${PROSE} Edited.`
