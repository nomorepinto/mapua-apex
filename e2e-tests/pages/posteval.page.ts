import { expect, type Page } from "@playwright/test"

import { PROSE } from "../support/data"
import { captureJson } from "../support/ui"

export class PostevalPage {
  constructor(private readonly page: Page) {}

  async file(title: string, options: { noBudget?: boolean } = {}) {
    await this.page.goto("/students/postevals")
    await this.page.getByLabel(/^Event/).click()
    await this.page.getByRole("option", { name: new RegExp(title) }).click()
    await this.page.getByRole("button", { name: "Continue" }).click()
    await expect(this.page).toHaveURL(/\/students\/postevals\/wizard/)
    await this.page.locator("[name='section_summary']").fill(`${PROSE} ${PROSE}`)
    await this.page.getByRole("button", { name: "Continue" }).click()
    if (options.noBudget) {
      // A no-budget submission skips the financial page: straight to attendance.
      await expect(this.page.getByText("Financial Report", { exact: true })).toHaveCount(0)
      await expect(this.page.getByText("Step 2 of 2 ·")).toBeVisible()
    } else {
      const actual = this.page.getByRole("textbox", { name: "Actual amount" }).first()
      if ((await actual.inputValue()) === "") await actual.fill("100")
      await this.page.getByRole("button", { name: "Continue" }).click()
    }
    await this.page.getByRole("button", { name: "Submit Post-Evaluation" }).click()
    await captureJson(this.page, "/students/postevals", "POST", async () => {
      await this.page.getByRole("button", { name: "Proceed" }).click()
    })
    await expect(this.page.getByText(/submitted|Post-evaluation|filed/i).first()).toBeVisible()
  }

  async expectEventAbsent(title: string) {
    await this.page.goto("/students/postevals")
    await this.page.getByLabel(/^Event/).click()
    await expect(this.page.getByRole("option", { name: new RegExp(title) })).toHaveCount(0)
    await this.page.keyboard.press("Escape")
  }

  async expectCouncilGate() {
    await this.page.goto("/students/postevals")
    await expect(
      this.page.getByText("This organization does not file a post-evaluation for its events."),
    ).toBeVisible()
  }
}

export class OsaarPostevalPage {
  constructor(private readonly page: Page) {}

  async open(title: string) {
    await this.page.goto("/osaar/postevals")
    await this.page.getByLabel("Search post-evaluations").fill(title)
    await this.page.getByRole("button", { name: title }).first().click()
  }

  async approve() {
    await this.page.getByRole("button", { name: "Approve", exact: true }).click()
    await this.page.getByRole("button", { name: "Proceed" }).click()
    await expect(this.page.getByRole("button", { name: "Working…" })).toBeHidden()
  }

  async deny() {
    await this.page.getByRole("button", { name: "Deny", exact: true }).click()
    await this.page.getByRole("button", { name: "Proceed" }).click()
    await expect(this.page.getByRole("button", { name: "Working…" })).toBeHidden()
  }

  async expectNoReturnOrDeny() {
    await expect(this.page.getByRole("button", { name: "Return" })).toHaveCount(0)
    await expect(this.page.getByRole("button", { name: "Deny", exact: true })).toHaveCount(0)
    await expect(this.page.getByText("Approved", { exact: true }).first()).toBeVisible()
  }
}
