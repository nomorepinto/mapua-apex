import { expect, type Page } from "@playwright/test"

import { choose, pickIsoDate } from "../support/ui"

/** Desk contact details an admin records for a signatory. */
export type SignatoryContact = {
  email?: string
  office?: string
  number?: string
}

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
    // C-1: seed one department + course so the S-7 officer campus→department→
    // program cascade has options on this otherwise-empty test campus. Use the
    // editor's input ids: getByLabel("Code") would also match "Course code".
    await this.page.getByRole("button", { name: "Add department" }).click()
    await this.page.locator("#add-campus-dept-code-0").fill("SOIT")
    await this.page.locator("#add-campus-dept-name-0").fill("School of Information Technology")
    await this.page.getByRole("button", { name: "Add course" }).click()
    await this.page.locator("#add-campus-course-code-0-0").fill("BSIT")
    await this.page.locator("#add-campus-course-name-0-0").fill("BS Information Technology")
    await this.page.getByRole("button", { name: "Add campus" }).click()
    await expect(this.page.getByRole("dialog", { name: "Campus added" }).first()).toBeVisible()
    await expect(this.page.getByRole("row", { name }).getByText("Main campus", { exact: true })).toBeVisible()
  }

  async expectMainNotOffered(holder: string) {
    await expect(this.page.getByRole("checkbox", { name: "Main campus" })).toHaveCount(0)
    await expect(this.page.getByRole("row", { name: holder }).getByText("Main campus", { exact: true })).toBeVisible()
  }

  private async releaseMainCampus() {
    // The campuses list loads asynchronously. While it loads the table renders
    // skeleton rows, so the holder check below races a 0-row read, skips the
    // release, and leaves offerMain false (no Main-campus checkbox to add with).
    // Wait for the loaded description before deciding there is no holder.
    await expect(this.page.getByText("use Edit to rename a row")).toBeVisible()
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

  /**
   * The "All campuses" OSAAR slot is a singleton: while any signatory holds it
   * the add form hides that option, so the test's own all-campus desk could
   * never pick it. Seed data may already carry an all-campus OSAAR, so demote
   * the current holder to a concrete campus before adding ours — same
   * release-the-predecessor pattern as releaseMainCampus for campuses.
   */
  async releaseAllCampuses() {
    const holder = this.page.getByRole("row").filter({ hasText: "All campuses" })
    if ((await holder.count()) === 0) return
    await holder.first().getByRole("button", { name: "Edit" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Edit signatory" })
    await expect(dialog.getByRole("combobox", { name: "Campus", exact: true })).toContainText("All campuses")
    await choose(this.page, dialog.getByRole("combobox", { name: "Campus", exact: true }), "Intramuros Campus")
    const save = dialog.getByRole("button", { name: "Save changes" })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(this.page.getByRole("dialog", { name: "Signatory updated" }).first()).toBeVisible()
    await expect(this.page.getByRole("row").filter({ hasText: "All campuses" })).toHaveCount(0)
  }

  async addSignatory(
    name: string,
    role: "Adviser" | "Dean" | "OSAAR" | "CDM",
    department?: string,
    campus?: string,
    contact?: SignatoryContact,
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
    if (contact?.email) await this.page.getByLabel("Contact email").fill(contact.email)
    if (contact?.office) await this.page.getByLabel("Office").fill(contact.office)
    if (contact?.number) await this.page.getByLabel("Contact number").fill(contact.number)
    await this.page.getByRole("button", { name: "Add signatory" }).click()
    await expect(this.page.getByRole("dialog", { name: "Signatory added" }).filter({ hasText: name })).toBeVisible()
    await expect(this.page.getByRole("row", { name })).toBeVisible()
  }

  /** The desk table reads the contact details back on the row's own Contact cell. */
  async expectSignatoryContact(name: string, contact: Required<SignatoryContact>) {
    const row = this.page.getByRole("row", { name })
    await expect(row.getByRole("link", { name: contact.email })).toBeVisible()
    await expect(row.getByText(`${contact.office} · ${contact.number}`, { exact: true })).toBeVisible()
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

  /** Assert the campus stage list is `first` above `second`, on the Approval stages tab. */
  async expectStageOrder(campus: string, first: string, second: string) {
    await this.page.getByRole("tab", { name: "Approval stages" }).click()
    const panel = this.page.getByRole("heading", { name: campus, exact: true }).locator("xpath=..")
    await expect(panel.getByText(first, { exact: true }).locator("xpath=..")).toContainText("1")
    await expect(panel.getByText(second, { exact: true }).locator("xpath=..")).toContainText("2")
  }

  /** Nudge a stage one slot toward the front of its campus list. */
  async moveStageUp(stageName: string) {
    const up = this.page.getByRole("button", { name: `Move ${stageName} up` })
    await expect(up).toBeEnabled()
    await up.click()
  }

  /** Persist the current draft order and wait for the success toast. */
  async saveStages() {
    const save = this.page.getByRole("button", { name: "Save stages" })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(this.page.getByText("Approval stages saved")).toBeVisible()
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
