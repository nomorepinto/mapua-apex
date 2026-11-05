import { expect, type Page } from "@playwright/test"

import {
  EQUIPMENT_REMARK,
  PROSE,
  ROOM_PURPOSE,
  SLOT_END,
  SLOT_START,
  normalizeDesk,
} from "../support/data"
import { eventDate } from "../support/env"
import { choose, pickIsoDate, stepPanel } from "../support/ui"

export type ReservationPick = {
  campus: string
  room?: string
  equipment?: string
  slot: number
}

export class SaafPage {
  constructor(private readonly page: Page) {}

  async start(title: string, reserve: boolean, budget = true) {
    await this.page.goto("/students/submissions")
    await this.page.getByLabel("Event name").fill(title)
    await choose(
      this.page,
      this.page.getByLabel("Are you going to reserve school facilities?"),
      reserve ? "Yes, reserve school facilities" : "No, do not reserve facilities",
    )
    await choose(
      this.page,
      this.page.getByLabel("Will you be operating with a budget?"),
      budget ? "Yes, we will operate with a budget" : "No, this activity has no budget",
    )
    await this.page.getByRole("button", { name: "Continue" }).click()
    await expect(this.page.getByRole("heading", { name: "Student Activity Application Form" })).toBeVisible()
  }

  async classification(activity: "extra-curricular" | "co-curricular") {
    const label = activity === "extra-curricular" ? "Extra-curricular Activity" : "Co-curricular Activity"
    await this.page.getByRole("radio", { name: label }).check()
    await stepPanel(this.page).locator("[name='totalOrgMembers']").fill("40")
    await this.continue()
  }

  async people(email: string, options: { chooseDepartment: boolean; stay?: boolean }) {
    const panel = stepPanel(this.page)
    await panel.getByPlaceholder("First Name").fill("Ana")
    await panel.getByPlaceholder("Last Name").fill("Reyes")
    await panel.getByPlaceholder("202XXXXXXX").fill("2026100101")
    if (options.chooseDepartment) {
      await choose(this.page, panel.getByRole("combobox", { name: "Department" }), /School of Information Technology/)
    }
    await expect(panel.getByRole("combobox", { name: "Program" })).toBeEnabled()
    await choose(this.page, panel.getByRole("combobox", { name: "Program" }), /BS Information Technology \(BSIT\)/)
    await choose(this.page, panel.getByRole("combobox", { name: "Year level" }), "1st Year")
    await panel.getByPlaceholder("President / Project Lead").fill("President")
    await panel.getByPlaceholder("09XXXXXXXXX").fill("09181234567")
    const emailField = panel.getByPlaceholder("student@mymail.mapua.edu.ph")
    await emailField.fill(email)
    await emailField.blur()
    await expect(panel.getByText("Verifying email...")).toBeHidden()
    await expect(panel.getByText("No mailbox exists for this address")).toHaveCount(0)
    await panel.getByPlaceholder("https://facebook.com/username").fill("https://facebook.com/anareyes")
    if (!options.stay) await this.continue()
  }

  async addCollaborator(org: string) {
    const box = stepPanel(this.page).getByRole("combobox", { name: "Collaborating organizations" })
    await box.click()
    const match = this.page.getByRole("listbox").last().getByRole("option", { name: org }).first()
    await expect(match).toBeVisible()
    await match.click()
    await this.page.keyboard.press("Escape")
    await expect(this.page.getByRole("listbox")).toHaveCount(0)
    await expect(box).toContainText(org)
  }

  /** Pick the campus, the event date, and one free slot on the reservation step. */
  async schedule(campus: string, slot: number) {
    const panel = stepPanel(this.page)
    await panel.locator("[name='expectedParticipants']").fill("40")
    await choose(this.page, panel.getByRole("combobox", { name: "Venue Campus" }), campus)
    await pickIsoDate(this.page, panel.getByRole("button", { name: "Start date of event" }), eventDate)
    await choose(this.page, panel.getByRole("combobox", { name: /Start time for / }), SLOT_START[slot])
    await choose(this.page, panel.getByRole("combobox", { name: /End time for / }), SLOT_END[slot])
  }

  /**
   * Rank the room suggestion panel for a headcount, by the Add buttons it offers.
   *
   * `fits` false means no single room holds the count, so the panel falls back to
   * the closest rooms — largest first for an oversized count — and says so.
   */
  async expectSuggestedRooms(headcount: number, ranked: string[], fits = true) {
    const panel = stepPanel(this.page)
    await panel.locator("[name='expectedParticipants']").fill(String(headcount))
    const box = panel.locator(`[aria-label='Suggested rooms for ${headcount} participants']`)
    await expect(box).toBeVisible()
    if (fits) {
      await expect(box).not.toContainText("No single room holds")
    } else {
      await expect(box).toContainText(`No single room holds ${headcount} participants.`)
    }
    const adds = box.getByRole("button", { name: /^Add / })
    const offered: string[] = []
    const total = await adds.count()
    for (let index = 0; index < total; index += 1) {
      offered.push(((await adds.nth(index).getAttribute("aria-label")) ?? "").replace(/^Add /, ""))
    }
    expect(offered).toEqual(ranked)
  }

  /** Add a suggested room through the panel, the shortcut for the room dropdown. */
  async addSuggestedRoom(room: string) {
    const panel = stepPanel(this.page)
    await panel.getByRole("button", { name: `Add ${room}`, exact: true }).click()
    await expect(panel.getByPlaceholder(/State purpose of reservation/)).toBeVisible()
  }

  async reservation(pick: ReservationPick) {
    await this.schedule(pick.campus, pick.slot)
    const panel = stepPanel(this.page)
    if (pick.room) {
      await choose(this.page, panel.getByRole("combobox", { name: "Select room to add" }), new RegExp(pick.room))
      await panel.getByRole("button", { name: "Add Room" }).click()
      await panel.getByPlaceholder(/State purpose of reservation/).fill(ROOM_PURPOSE)
    }
    if (pick.equipment) {
      await choose(this.page, panel.getByRole("combobox", { name: "Select equipment" }), new RegExp(pick.equipment))
      await panel.getByPlaceholder(/Remark/).fill(EQUIPMENT_REMARK)
      await panel.getByRole("button", { name: "Add", exact: true }).click()
    }
    await this.continue()
  }

  async expectEquipmentBlocked(campus: string, slot: number) {
    await this.schedule(campus, slot)
    await expect(stepPanel(this.page).getByText("Reserve at least one room on the left first.")).toBeVisible()
  }

  async activityOnline(campusOnline = "Online", budget = true) {
    const panel = stepPanel(this.page)
    await panel.getByPlaceholder(/comprehensive summary/).fill(PROSE)
    await panel.getByPlaceholder(/primary targets/).fill(PROSE)
    await choose(this.page, panel.getByRole("combobox", { name: "Venue Campus" }), campusOnline)
    await pickIsoDate(this.page, panel.getByRole("button", { name: "Start date of event" }), eventDate)
    await pickIsoDate(this.page, panel.getByRole("button", { name: "End date of event" }), eventDate)
    await choose(this.page, panel.getByRole("combobox", { name: "Start hour" }), "8")
    await choose(this.page, panel.getByRole("combobox", { name: "Start minute" }), "00")
    await choose(this.page, panel.getByRole("combobox", { name: "Start AM or PM" }), "AM")
    await choose(this.page, panel.getByRole("combobox", { name: "End hour" }), "9")
    await choose(this.page, panel.getByRole("combobox", { name: "End minute" }), "20")
    await choose(this.page, panel.getByRole("combobox", { name: "End AM or PM" }), "AM")
    await panel.locator("[name='expectedParticipants']").fill("40")
    // The individual contribution input only exists for a with-budget paper.
    if (budget) await panel.getByPlaceholder("0.00").fill("0")
    await this.continue()
  }

  async activityReserved(budget = true) {
    const panel = stepPanel(this.page)
    await panel.getByPlaceholder(/comprehensive summary/).fill(PROSE)
    await panel.getByPlaceholder(/primary targets/).fill(PROSE)
    if (budget) await panel.getByPlaceholder("0.00").fill("0")
    await this.continue()
  }

  async alignment(budget = true) {
    const panel = stepPanel(this.page)
    await panel.getByRole("checkbox", { name: /globally competitive/ }).check()
    await panel.getByPlaceholder(/core values/).fill(PROSE)
    await panel.getByPlaceholder(/targeted SDGs/).fill(PROSE)
    if (!budget) return
    await choose(this.page, panel.getByRole("combobox", { name: "Budget item" }), "Food and Refreshments")
    await panel.getByRole("textbox", { name: "Quantity" }).fill("2")
    await panel.getByRole("textbox", { name: "Price per unit" }).fill("50")
  }

  /** A no-budget paper never renders the line-item table or the money inputs. */
  async expectBudgetAbsent() {
    const panel = stepPanel(this.page)
    await expect(panel.getByRole("combobox", { name: "Budget item" })).toHaveCount(0)
    await expect(this.page.getByPlaceholder("0.00")).toHaveCount(0)
    await expect(this.page.getByText("Alignment & budget")).toHaveCount(0)
  }

  async submit() {
    await this.page.getByRole("button", { name: "Submit", exact: true }).click()
    await this.page.getByRole("button", { name: "Proceed" }).click()
    await expect(this.page.getByRole("heading", { name: "Activity Application Submitted!" })).toBeVisible()
    await this.page.getByRole("button", { name: "Back to Dashboard" }).click()
    await expect(this.page).toHaveURL(/\/students\/dashboard/)
  }

  async continue() {
    const button = this.page.getByRole("button", { name: "Continue", exact: true })
    try {
      await expect(button).toBeEnabled()
    } catch (error) {
      const issues = await this.page.locator("#saaf-step-issues").textContent().catch(() => "")
      throw new Error(issues || String(error))
    }
    await button.click()
  }

  /** Walk a hydrated returned paper. `onStep` runs before leaving that step. Step -1 is the submit step. */
  async resubmitPrefilled(onStep?: (index: number) => Promise<void>) {
    await expect(this.page.locator("[name='activityDescription']")).not.toHaveValue("", { timeout: 30_000 })
    await expect(this.page.locator("[name='proponent_0_firstName']")).not.toHaveValue("", { timeout: 30_000 })
    let index = 0
    for (let guard = 0; guard < 6; guard += 1) {
      const submit = this.page.getByRole("button", { name: "Submit", exact: true })
      if (await submit.isVisible()) {
        if (onStep) await onStep(-1)
        await this.alignmentIfEmpty()
        await this.submit()
        return
      }
      if (onStep) await onStep(index)
      await this.continue()
      index += 1
    }
    throw new Error("Resubmit did not reach the submit step.")
  }

  private async alignmentIfEmpty() {
    const core = this.page.getByPlaceholder(/core values/)
    if (await core.isVisible() && (await core.inputValue()) === "") await this.alignment()
  }
}

export async function trackerRoles(page: Page, title: string): Promise<string[]> {
  // The dashboard renders several "Search records" toolbars (proposals, post-evals);
  // scope to the proposals panel so the tracker search is unambiguous.
  await page.getByRole("region", { name: "Proposal statistics filters" }).getByLabel("Search records").fill(title)
  await page.locator("tr").filter({ hasText: title }).first().click()
  const dialog = page.getByRole("dialog", { name: `${title} Proposal` })
  await dialog.getByRole("button", { name: "Milestone & Progress" }).click()
  const reviewers = dialog.getByText("Required Reviewers", { exact: true }).locator("xpath=..")
  await expect(reviewers).toBeVisible()
  const labels = await reviewers.locator("span.font-bold").allTextContents()
  await dialog.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  return labels.map((label) => label.trim()).filter((label) => /Adviser|Dean|OSAAR|CDM/.test(label))
}

export type SignatoryDesk = {
  /** Everything the desk row shows, whitespace collapsed. */
  text: string
  /** Whether the proposal is sitting on this desk right now. */
  awaiting: boolean
  /** The `mailto:` the row offers, or "" when no email is on file. */
  email: string
}

/**
 * Open a filed paper's tracker and read its Signatories tab: the desks the
 * proponent may still write to, in approval order. `expected` is asserted before
 * the rows are read, so a still-loading detail cannot pass as an empty chain.
 */
export async function trackerSignatories(
  page: Page,
  title: string,
  expected: number,
): Promise<SignatoryDesk[]> {
  await page.goto("/students/dashboard")
  await page.getByRole("region", { name: "Proposal statistics filters" }).getByLabel("Search records").fill(title)
  await page.locator("tr").filter({ hasText: title }).first().click()
  const dialog = page.getByRole("dialog", { name: `${title} Proposal` })
  await dialog.getByRole("button", { name: "Signatories", exact: true }).click()
  const card = dialog.getByRole("heading", { name: "Signatory Contacts" }).locator("xpath=../..")
  await expect(card).toBeVisible()
  const rows = card.locator("ol > li")
  await expect(rows).toHaveCount(expected)
  const desks: SignatoryDesk[] = []
  for (let index = 0; index < expected; index += 1) {
    const row = rows.nth(index)
    const mailto = row.locator("a[href^='mailto:']").first()
    desks.push({
      text: (await row.innerText()).replace(/\s+/g, " ").trim(),
      awaiting: (await row.getByText("Awaiting this desk", { exact: true }).count()) > 0,
      email: (await mailto.count()) > 0 ? ((await mailto.getAttribute("href")) ?? "") : "",
    })
  }
  await dialog.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  return desks
}

export function rolesMatch(actual: string[], expected: string[]) {
  expect(actual.map(normalizeDesk)).toEqual(expected.map(normalizeDesk))
}
