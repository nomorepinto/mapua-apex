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
    await this.page.getByLabel("Search review queue").fill(title)
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
    const approve = this.page.getByRole("button", { name: "Approve Proposal" })
    const major = this.page.getByRole("button", { name: "Major Event" })
    // Waiting for Approve to render means the modal body has hydrated, so the
    // presence of the classification control below is reliable (not a race).
    await expect(approve).toBeVisible()
    // OSAAR desks render the event-nature control and gate Approve behind it;
    // every other desk omits it. Approve is also briefly disabled while the
    // booking-conflict check runs, so decide on the control, not the disabled
    // state, then wait for Approve to settle enabled.
    if (await major.isVisible()) await major.click()
    await expect(approve).toBeEnabled()
    await approve.click()
    const confirm = this.page.getByRole("dialog", { name: /Endorse/ })
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
    const approve = this.page.getByRole("button", { name: "Approve Proposal" })
    await expect(approve).toBeDisabled()
    await expect(approve).toHaveAttribute(
      "title",
      "Some reserved slots are already booked. Return or reject this proposal.",
    )
    await expect(this.page.getByText("This reservation can't be approved as filed.")).toBeVisible()
  }
}
