import fs from "node:fs"
import path from "node:path"

import QRCode from "qrcode"
import { expect, type Page } from "@playwright/test"

import { root } from "../support/env"

export class AttendancePage {
  constructor(private readonly page: Page) {}

  async dismissInstructions() {
    const dialog = this.page.getByRole("dialog", { name: "Before you continue" })
    await dialog.waitFor({ state: "visible" })
    await dialog.getByRole("button", { name: "Agree and proceed" }).click()
    await expect(dialog).toBeHidden()
  }

  async register(first: string, last: string, studentNumber: string) {
    await this.page.goto("/")
    await this.dismissInstructions()
    await this.page.getByLabel("First Name").fill(first)
    await this.page.getByLabel("Last Name").fill(last)
    await this.page.getByLabel("Student Number").fill(studentNumber)
    await this.page.getByLabel("Department").click()
    await this.page.getByRole("option", { name: /Information Technology/ }).first().click()
    await this.page.getByLabel("Program").click()
    await this.page.getByRole("option", { name: /Information Technology/ }).first().click()
    await this.page.getByLabel("Year Level").click()
    await this.page.getByRole("option", { name: /1st Year|First/ }).first().click()
    await this.page.getByRole("button", { name: "Save student" }).click()
    await expect(this.page.getByText(studentNumber)).toBeVisible()
  }

  async scanFile(studentNumber: string, eventTitle: string) {
    const file = path.join(root, "state", `qr-${studentNumber}.png`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    await QRCode.toFile(file, studentNumber)
    await this.page.goto("/scanner")
    await this.page.getByLabel("Event").click().catch(async () => {
      await this.page.getByRole("combobox").first().click()
    })
    await this.page.getByRole("option", { name: new RegExp(eventTitle) }).click()
    await this.page.getByRole("button", { name: "Upload File" }).click()
    await this.page.locator("input[type='file']").setInputFiles(file)
  }

  async expectAlert(text: string | RegExp) {
    await expect(this.page.getByRole("alert").or(this.page.locator("[role='status']")).or(this.page.getByText(text)).first()).toBeVisible()
    await expect(this.page.getByText(text).first()).toBeVisible()
  }

  async membersOnly() {
    await this.page.getByRole("switch", { name: "Allow members only" }).click()
  }
}

export class EvaluationPage {
  constructor(private readonly page: Page) {}

  async file(eventTitle: string) {
    await this.page.goto("/")
    await this.page.getByRole("link", { name: new RegExp(eventTitle) }).click()
    await this.page.getByLabel("Department").click()
    await this.page.getByRole("option", { name: /Information Technology/ }).first().click()
    await this.page.getByRole("radio", { name: "Yes", exact: true }).check()
    await this.page.getByLabel(/What activity or program/).fill("General assembly planning session")
    await this.page.getByRole("checkbox", { name: "Classmate / schoolmate" }).check()
    const ratings = this.page.getByRole("radio", { name: /\(5\) for item/ })
    const count = await ratings.count()
    for (let index = 0; index < count; index += 1) await ratings.nth(index).check()
    await this.page.getByRole("button", { name: "Review PDF" }).click()
    await this.page.getByRole("button", { name: "Submit evaluation" }).click()
    await expect(this.page.getByRole("heading", { name: /Submitted/ })).toBeVisible()
  }

  async expectAttendance(eventTitle: string) {
    await this.page.goto("/officer")
    await this.page.getByLabel("Event").click()
    await this.page.getByRole("option", { name: new RegExp(eventTitle) }).click()
    await expect(this.page.getByText(/([2-9]|\d{2,}) attendance records/)).toBeVisible()
  }

  async expectEventAbsent(eventTitle: string) {
    await this.page.goto("/")
    await expect(this.page.getByRole("link", { name: new RegExp(eventTitle) })).toHaveCount(0)
  }
}
