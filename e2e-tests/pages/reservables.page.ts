import { expect, type Page } from "@playwright/test"

import { freeSlotName } from "../support/data"
import { choose, pickIsoDate } from "../support/ui"

export class ReservablesPage {
  constructor(private readonly page: Page) {}

  async addRoom(campus: string, name: string, min: string, max: string, classroom: boolean) {
    await this.page.goto("/cdm/reservables/add")
    // S-8: the combined form is split into two tabs, each fixing its type.
    await this.page.getByRole("tab", { name: "Add Room" }).click()
    await choose(this.page, this.page.getByLabel("Campus"), campus)
    await this.page.getByLabel("Name").fill(name)
    // S-9: the classroom decision precedes the capacity fields.
    if (classroom) await this.page.getByRole("checkbox", { name: "This room is a classroom" }).check()
    await this.page.getByLabel("Minimum participants").fill(min)
    await this.page.getByLabel("Maximum participants").fill(max)
    await this.page.getByRole("button", { name: "Add room" }).click()
    await expect(this.page.getByRole("dialog", { name: "Room added" }).first()).toBeVisible()
  }

  async addEquipment(campus: string, name: string, quantity: string) {
    await this.page.goto("/cdm/reservables/add")
    await this.page.getByRole("tab", { name: "Add Campus Equipment" }).click()
    await choose(this.page, this.page.getByLabel("Campus"), campus)
    await this.page.getByLabel("Name").fill(name)
    await this.page.getByLabel(/Max Quantity/).fill(quantity)
    await this.page.getByRole("button", { name: "Add campus equipment" }).click()
    await expect(this.page.getByRole("dialog", { name: "Campus equipment added" }).first()).toBeVisible()
  }

  async expectListed(campus: string, name: string) {
    await this.page.goto("/cdm/reservables/view")
    await choose(this.page, this.page.getByLabel("Campus"), campus)
    await choose(this.page, this.page.getByRole("combobox", { name: "Reservable", exact: true }), name)
    await expect(this.page.getByText(name).first()).toBeVisible()
  }

  async holdAndRelease(campus: string, reservable: string, iso: string, slot: number) {
    await this.page.goto("/cdm/reservables/reserve")
    await choose(this.page, this.page.getByLabel("Campus"), campus)
    await choose(this.page, this.page.getByRole("combobox", { name: "Reservable", exact: true }), reservable)
    await pickIsoDate(this.page, this.page.getByLabel("Date"), iso)
    await this.page.getByRole("checkbox", { name: freeSlotName(slot) }).click()
    await this.page.getByRole("button", { name: "Reserve slots" }).click()
    await expect(this.page.getByRole("dialog", { name: "Slot reserved" }).first()).toBeVisible()
    await this.page.getByRole("button", { name: "Release hold" }).click()
    await expect(this.page.getByRole("dialog", { name: "Hold released" }).first()).toBeVisible()
  }

  async hold(campus: string, reservable: string, iso: string, slot: number) {
    await this.page.goto("/cdm/reservables/reserve")
    await choose(this.page, this.page.getByLabel("Campus"), campus)
    await choose(this.page, this.page.getByRole("combobox", { name: "Reservable", exact: true }), reservable)
    await pickIsoDate(this.page, this.page.getByLabel("Date"), iso)
    await this.page.getByRole("checkbox", { name: freeSlotName(slot) }).click()
    await this.page.getByRole("button", { name: "Reserve slots" }).click()
    await expect(this.page.getByRole("dialog", { name: "Slot reserved" }).first()).toBeVisible()
  }
}
