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
    await expect(this.page.getByRole("dialog", { name: `${title} Proposal` })).toBeVisible()
  }

  async approve() {
    const major = this.page.getByRole("button", { name: "Major Event" })
    if (await major.count()) await major.click()
    await this.page.getByRole("button", { name: "Approve Proposal" }).click()
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
