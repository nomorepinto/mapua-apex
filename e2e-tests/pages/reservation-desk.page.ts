import { expect, type Page } from "@playwright/test"

import { freeSlotName } from "../support/data"
import { eventDate } from "../support/env"
import { pickIsoDate } from "../support/ui"

export class ReservationDeskPage {
  constructor(private readonly page: Page) {}

  async open(campus: string, title: string) {
    await this.page.goto("/cdm/reservations")
    await this.page.getByLabel("Campus").selectOption({ label: campus }).catch(async () => {
      await this.page.getByLabel("Campus").click()
      await this.page.getByRole("option", { name: campus }).click()
    })
    await this.page.getByRole("button", { name: new RegExp(title) }).first().click()
    await expect(this.page.getByText("Resolution", { exact: true })).toBeVisible()
  }

  async reschedule(slot: number) {
    await this.page.getByRole("button", { name: "Change", exact: true }).first().click()
    await pickIsoDate(this.page, this.page.getByLabel("Date"), eventDate)
    await this.page.getByRole("checkbox", { name: freeSlotName(slot) }).click()
    await this.page.getByRole("button", { name: "Apply reschedule" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Apply reschedule?" })
    await dialog.getByRole("button", { name: "Apply reschedule" }).click()
    await expect(this.page.getByRole("dialog", { name: "Event rescheduled" })).toBeVisible()
  }

  async deny() {
    await this.page.getByRole("button", { name: "Deny", exact: true }).click()
    const dialog = this.page.getByRole("dialog", { name: "Deny this request?" })
    await dialog.getByLabel(/Comment/).fill("The requested move is denied because the room stays on the original plan.")
    await dialog.getByRole("button", { name: "Deny request" }).click()
    await expect(this.page.getByRole("dialog", { name: "Request denied" })).toBeVisible()
  }

  async cancel() {
    await this.page.getByRole("button", { name: "Cancel event" }).click()
    const dialog = this.page.getByRole("dialog", { name: "Cancel this event?" })
    await dialog.getByRole("button", { name: "Cancel event" }).click()
    await expect(this.page.getByRole("dialog", { name: "Event cancelled" })).toBeVisible()
  }
}
