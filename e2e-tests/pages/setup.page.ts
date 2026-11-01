import { expect, type Page } from "@playwright/test"

import { choose, pickIsoDate } from "../support/ui"

export class SetupPages {
  constructor(private readonly page: Page) {}

  async open(path: string) {
    await this.page.goto(path)
    const heading = this.page.getByRole("heading", { name: "Setup" })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await expect(heading).toBeVisible({ timeout: 8_000 })
        return
      } catch (error) {
        if (attempt === 2) throw error
        await this.page.reload()
      }
    }
  }

  async addCampus(name: string) {
    await this.page.getByRole("tab", { name: "Campuses" }).click()
    await this.page.getByLabel("Name").fill(name)
    await this.page.getByLabel("Allowed prefixes").fill("R")
    await this.page.getByLabel("Digit count").fill("3")
    await this.page.getByRole("button", { name: "Add campus" }).click()
    await expect(this.page.getByRole("dialog", { name: "Campus added" }).first()).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  async rejectCampusWithoutDigits(name: string) {
    await this.page.getByLabel("Name").fill(name)
    await this.page.getByLabel("Allowed prefixes").fill("R")
    await this.page.getByLabel("Digit count").fill("")
    await this.page.getByRole("button", { name: "Add campus" }).click()
    await expect(this.page.getByText("Add a digit count to complete the classroom name format.")).toBeVisible()
  }

  async addSignatory(name: string, role: "Adviser" | "Dean" | "OSAAR" | "CDM", department?: string) {
    await this.page.getByRole("tab", { name: "Signatories" }).click()
    await this.page.getByLabel("Name").fill(name)
    await choose(this.page, this.page.getByRole("combobox", { name: "Role" }), role)
    if (department) {
      await choose(this.page, this.page.getByRole("combobox", { name: "Department" }), department)
    }
    await this.page.getByRole("button", { name: "Add signatory" }).click()
    await expect(this.page.getByRole("dialog", { name: "Signatory added" }).filter({ hasText: name })).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  async addOrganization(name: string, adviser: string, dean?: string) {
    await this.page.getByRole("tab", { name: "Organizations" }).click()
    await this.page.getByLabel("Name").fill(name)
    if (!dean) await this.page.getByRole("checkbox", { name: "Higher council" }).check()
    await choose(this.page, this.page.getByRole("combobox", { name: "Adviser" }), adviser)
    if (dean) await choose(this.page, this.page.getByRole("combobox", { name: "Dean" }), dean)
    await this.page.getByRole("button", { name: "Add organization" }).click()
    await expect(this.page.getByRole("dialog", { name: "Organization added" }).filter({ hasText: name })).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  async saveStages(first: string, second: string) {
    await this.page.getByRole("tab", { name: "Approval stages" }).click()
    await choose(this.page, this.page.getByRole("combobox", { name: "OSAAR 1" }), first)
    await this.page.getByRole("button", { name: "Add OSAAR stage" }).click()
    await choose(this.page, this.page.getByRole("combobox", { name: "OSAAR 2" }), second)
    await this.page.getByRole("button", { name: "Save stages" }).click()
    await expect(this.page.getByRole("dialog", { name: "Approval stages saved" }).first()).toBeVisible()
  }

  async assignAccount(rowName: string, accountLabel: string) {
    const box = this.page.getByRole("row", { name: rowName }).getByRole("combobox", { name: "Assigned account" })
    await box.click()
    await this.page.keyboard.press("Control+A")
    await this.page.keyboard.type(accountLabel)
    await this.page.getByRole("option", { name: accountLabel }).first().click()
    await expect.poll(async () => box.inputValue()).toContain(accountLabel)
  }

  async rejectAdminSelfAssign(rowName: string, email: string): Promise<"blocked" | "assigned"> {
    const row = this.page.getByRole("row", { name: rowName })
    const box = row.getByRole("combobox", { name: "Assigned account" })
    await box.click()
    await this.page.keyboard.press("Control+A")
    await this.page.keyboard.type(email)
    await this.page.getByRole("option", { name: email }).first().click()
    const toast = this.page.getByRole("dialog", { name: "Could not assign account" })
    const appeared = await toast
      .first()
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false)
    if (appeared) {
      await expect(toast.first()).toContainText("You cannot change the Cognito account assigned to yourself.")
      return "blocked"
    }
    await row.getByRole("button", { name: "Clear assigned account" }).click()
    await expect.poll(async () => box.inputValue()).toBe("")
    return "assigned"
  }
}
