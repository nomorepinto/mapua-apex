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
    await this.releaseMainCampus()
    const main = this.page.getByRole("checkbox", { name: "Main campus" })
    await expect(main).toBeVisible()
    if (!(await main.isChecked())) await main.check()
    await this.page.getByLabel("Name").fill(name)
    await this.page.getByLabel("Allowed prefixes").fill("R")
    await this.page.getByLabel("Digit count").fill("3")
    await this.page.getByRole("button", { name: "Add campus" }).click()
    await expect(this.page.getByRole("dialog", { name: "Campus added" }).first()).toBeVisible()
    await expect(this.page.getByRole("row", { name }).getByText("Main campus", { exact: true })).toBeVisible()
  }

  async expectMainNotOffered(holder: string) {
    await expect(this.page.getByRole("checkbox", { name: "Main campus" })).toHaveCount(0)
    await expect(this.page.getByRole("row", { name: holder }).getByText("Main campus", { exact: true })).toBeVisible()
  }

  private async releaseMainCampus() {
    const holder = this.page.getByRole("row").filter({ hasText: "Main campus" })
    if ((await holder.count()) === 0) return
    await holder.first().getByRole("button", { name: "Edit" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Edit campus" })
    const main = dialog.getByRole("checkbox", { name: "Main campus" })
    await expect(main).toBeChecked()
    await main.uncheck()
    const save = dialog.getByRole("button", { name: "Save changes" })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(this.page.getByRole("dialog", { name: "Campus updated" }).first()).toBeVisible()
    await expect(this.page.getByRole("checkbox", { name: "Main campus" })).toBeVisible()
  }

  async rejectCampusWithoutDigits(name: string) {
    await this.page.getByLabel("Name").fill(name)
    await this.page.getByLabel("Allowed prefixes").fill("R")
    await this.page.getByLabel("Digit count").fill("")
    await this.page.getByRole("button", { name: "Add campus" }).click()
    await expect(this.page.getByText("Add a digit count to complete the classroom name format.")).toBeVisible()
  }

  async addSignatory(
    name: string,
    role: "Adviser" | "Dean" | "OSAAR" | "CDM",
    department?: string,
    campus?: string,
  ) {
    await this.page.getByRole("tab", { name: "Signatories" }).click()
    await this.page.getByLabel("Name").fill(name)
    await choose(this.page, this.page.getByRole("combobox", { name: "Role" }), role)
    if (department) {
      await choose(this.page, this.page.getByRole("combobox", { name: "Department" }), department)
    }
    if (role === "OSAAR") {
      await choose(this.page, this.page.getByRole("combobox", { name: "Campus" }), campus ?? "All campuses")
    }
    await this.page.getByRole("button", { name: "Add signatory" }).click()
    await expect(this.page.getByRole("dialog", { name: "Signatory added" }).filter({ hasText: name })).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  async addOrganization(name: string, adviser: string, dean?: string) {
    await this.page.getByRole("tab", { name: "Organizations" }).click()
    await this.page.getByLabel("Name").fill(name)
    if (!dean) {
      await this.page.getByRole("checkbox", { name: "Skip dean" }).check()
      await this.page.getByRole("checkbox", { name: "Skip post-eval" }).check()
    }
    await choose(this.page, this.page.getByRole("combobox", { name: "Adviser" }), adviser)
    if (dean) await choose(this.page, this.page.getByRole("combobox", { name: "Dean" }), dean)
    await this.page.getByRole("button", { name: "Add organization" }).click()
    await expect(this.page.getByRole("dialog", { name: "Organization added" }).filter({ hasText: name })).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  async expectOsaarCampuses(campus: string, first: string, second: string, all: string) {
    await this.page.getByRole("tab", { name: "Approval stages" }).click()
    const panel = this.page.getByRole("heading", { name: campus, exact: true }).locator("xpath=..")
    await expect(panel.getByText(first, { exact: true }).locator("xpath=..")).toContainText("1")
    await expect(panel.getByText(second, { exact: true }).locator("xpath=..")).toContainText("2")
    await expect(panel.getByText(campus, { exact: true })).toHaveCount(3)
    await expect(this.page.getByText(all, { exact: true })).toBeVisible()
    await expect(this.page.getByText("All campuses", { exact: true })).toBeVisible()
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
