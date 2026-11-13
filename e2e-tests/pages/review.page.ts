import { expect, type Page } from "@playwright/test"

import { DENY_COMMENT, RETURN_COMMENT } from "../support/data"

const PATHS: Record<string, string> = {
  adv1: "/adviser/dashboard",
  adv2: "/adviser/dashboard",
  adv3: "/adviser/dashboard",
  dean1: "/dean/dashboard",
  dean2: "/dean/dashboard",
  osaar1: "/osaar/dashboard/review",
  osaar2: "/osaar/dashboard/review",
  osaarAll: "/osaar/dashboard/review",
  cdm1: "/cdm/dashboard",
}

export class ReviewPage {
  constructor(private readonly page: Page) {}

  async open(desk: string, title: string) {
    await this.page.goto(PATHS[desk])
    // The desk mounts its review-queue section asynchronously: the search box
    // renders unconditionally, but the section itself can lag on a cold route
    // compile or a slow queue fetch. A one-shot fill right after goto raced that
    // mount and flaked with a 20s timeout, so wait for the box to be visible.
    const search = this.page.getByLabel("Search review queue")
    await expect(search).toBeVisible({ timeout: 60_000 })
    await search.fill(title)
    await this.page.getByRole("button", { name: `View details for ${title}` }).click()
    const dialog = this.page.getByRole("dialog", { name: `${title} Proposal` })
    await expect(dialog).toBeVisible()
    // The dialog paints before the desk's review queue finishes loading. Until
    // that query resolves the paper is not yet in the "For Review" list, so the
    // modal treats it as read-only history and renders no Return / Reject /
    // Approve buttons (use-review-dashboard isReadOnly). Wait for the actionable
    // footer once here so approve(), returnProposal(), and reject() never race a
    // still-loading queue — the same hydration guard approve() already relies on.
    await expect(
      this.page.getByRole("button", { name: "Return Proposal" }).first(),
    ).toBeVisible({ timeout: 30_000 })
  }

  async approve() {
    const approve = this.page.getByRole("button", { name: /^(Approve|Review) Proposal$/ })
    const major = this.page.getByRole("button", { name: "Major Event" })
    await expect(approve).toBeVisible()
    // OSAAR desks render an event-nature control and gate Approve behind it,
    // flagging the button title="Select an event classification first" until a
    // nature is set; every other desk omits the control and the title. The app's
    // classification handler is fire-and-forget (errors are caught, not thrown),
    // so a single isVisible()+click can silently miss: right after a return and
    // resubmit the control may still be hydrating, or the PATCH may land before
    // the fresh submission is ready. Drive the gate off the Approve title itself
    // — wait for the control, click it, and re-click until the title clears.
    const gate = "Select an event classification first"
    if ((await approve.getAttribute("title")) === gate) {
      await expect(major).toBeVisible({ timeout: 30_000 })
      await expect
        .poll(
          async () => {
            if ((await approve.getAttribute("title")) !== gate) return "cleared"
            // Major is disabled while the classification mutation is in flight,
            // so this only re-clicks when a prior attempt truly didn't stick.
            if (await major.isEnabled().catch(() => false)) await major.click()
            return "gated"
          },
          { timeout: 30_000, intervals: [500] },
        )
        .toBe("cleared")
    }
    await expect(approve).toBeEnabled({ timeout: 30_000 })
    await approve.click()
    // R-1: the confirm title is now "${verb} ${title}?" (was "Endorse ...").
    const confirm = this.page.getByRole("dialog", { name: /^(Approve|Review) .+\?$/ })
    await confirm.getByRole("button", { name: "Proceed" }).click()
    await expect(confirm).toBeHidden()
  }

  async returnProposal() {
    await this.page.getByRole("button", { name: "Return Proposal" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Return Proposal for Revision" })
    await dialog.getByLabel(/Reason for return/).fill(RETURN_COMMENT)
    await dialog.getByRole("button", { name: "Return Proposal" }).click()
    await expect(dialog).toBeHidden()
  }

  async reject() {
    await this.page.getByRole("button", { name: "Reject Proposal" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Reject Proposal" })
    await dialog.getByLabel(/Reason for rejection/).fill(DENY_COMMENT)
    await dialog.getByRole("button", { name: "Reject Proposal" }).click()
    await expect(dialog).toBeHidden()
  }

  async expectApprovalBlocked() {
    const approve = this.page.getByRole("button", { name: /^(Approve|Review) Proposal$/ })
    await expect(approve).toBeDisabled()
    await expect(approve).toHaveAttribute(
      "title",
      "Some reserved slots are already booked. Return or reject this proposal.",
    )
    await expect(this.page.getByText("This reservation can't be approved as filed.")).toBeVisible()
  }

  /** R-1: the footer action verb — "Approve" for a campus OSAAR, "Review" otherwise. */
  async expectActionVerb(verb: "Approve" | "Review") {
    const other = verb === "Approve" ? "Review" : "Approve"
    await expect(
      this.page.getByRole("button", { name: `${verb} Proposal`, exact: true }),
    ).toBeVisible()
    await expect(
      this.page.getByRole("button", { name: `${other} Proposal`, exact: true }),
    ).toHaveCount(0)
  }

  /** R-1: the major/minor classification control renders only for the all-campus OSAAR. */
  async expectClassificationControl(visible: boolean) {
    const major = this.page.getByRole("button", { name: "Major Event", exact: true })
    if (visible) await expect(major).toBeVisible()
    else await expect(major).toHaveCount(0)
  }

  /** S-8: CDM cannot approve until every outside-equipment item has a ruling. */
  async expectOutsideEquipmentGate() {
    const approve = this.page.getByRole("button", { name: /^(Approve|Review) Proposal$/ })
    await expect(approve).toBeDisabled()
    await expect(approve).toHaveAttribute(
      "title",
      "Rule on every outside equipment item (allowed / not allowed) first",
    )
    await expect(
      this.page.getByText("Rule on each item before approving this proposal."),
    ).toBeVisible()
  }

  /**
   * S-8: rule on one outside-equipment item. Every decision button shares the
   * in-flight disabled flag, so waiting for the PATCH to land serializes the
   * clicks and keeps the per-item decisions from racing each other.
   */
  async decideOutsideEquipment(name: string, allowed: boolean) {
    const row = this.page.getByRole("listitem").filter({ hasText: name })
    // exact: true — "Allowed" is a substring of "Not allowed".
    const button = row.getByRole("button", {
      name: allowed ? "Allowed" : "Not allowed",
      exact: true,
    })
    await expect(button).toBeEnabled()
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes("/outside-equipment") &&
          response.request().method() === "PATCH" &&
          response.ok(),
        { timeout: 30_000 },
      ),
      button.click(),
    ])
  }

  /**
   * Assert the already-open desk modal shows the "Funding sources" row for a
   * with-budget paper. The caller opens the modal first via open().
   */
  async expectFundingSources(title: string, labels: string[]) {
    const dialog = this.page.getByRole("dialog", { name: `${title} Proposal` })
    const row = dialog.getByText("Funding sources", { exact: true }).locator("xpath=..")
    await expect(row).toBeVisible()
    await expect(row).toContainText(labels.join(", "))
  }

  async expectBudgetNote(title: string, text: string) {
    const dialog = this.page.getByRole("dialog", { name: `${title} Proposal` })
    const row = dialog.getByText("Budget Note", { exact: true }).locator("xpath=..")
    await expect(row).toBeVisible()
    await expect(row).toContainText(text)
  }
}
