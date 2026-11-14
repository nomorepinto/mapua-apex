import { expect, type Page } from "@playwright/test"

import {
  BUDGET_NOTE,
  EQUIPMENT_REMARK,
  PROSE,
  ROOM_PURPOSE,
  SLOT_END,
  SLOT_START,
  normalizeDesk,
} from "../support/data"
import { eventDate } from "../support/env"
import { checkMulti, choose, pickIsoDate, stepPanel } from "../support/ui"

export type ReservationPick = {
  campus: string
  room?: string
  equipment?: string
  slot: number
  /** S-8: outside equipment (not from Mapua) CDM must rule on item-by-item. */
  outside?: { name: string; purpose?: string }[]
}

export class SaafPage {
  constructor(private readonly page: Page) {}

  async start(
    title: string,
    reserve: boolean,
    budget = true,
    funding = ["Sponsors", "Organization"],
    campusLocation: "on-campus" | "off-campus" = "on-campus",
  ) {
    await this.page.goto("/students/submissions")
    await this.page.getByLabel("Event name").fill(title)
    // S-5: campus location is chosen first; off-campus forces facilities to "no".
    await choose(
      this.page,
      this.page.getByLabel("Where will the event be held?"),
      campusLocation === "on-campus" ? "On-campus" : "Off-campus",
    )
    const facilities = this.page.getByLabel(
      "Are you going to reserve school facilities/bring outside equipment?",
    )
    if (campusLocation === "off-campus") {
      // S-5/S-10: off-campus greys out facilities and forces "No, neither".
      await expect(facilities).toBeDisabled()
      await expect(facilities).toContainText("No, neither")
    } else {
      await choose(
        this.page,
        facilities,
        reserve ? "Yes, reserve facilities / bring outside equipment" : "No, neither",
      )
    }
    await choose(
      this.page,
      this.page.getByLabel("Will you be operating with a budget?"),
      budget ? "Yes, we will operate with a budget" : "No, this activity has no budget",
    )
    // Setup-step T&C consent gate: Continue stays disabled until the
    // agreement under the "Terms and conditions" button is ticked.
    await this.acceptSetupTerms()
    if (budget) {
      // A with-budget paper must name at least one funding source before it can
      // leave the setup step: assert the gate blocks Continue, then satisfy it.
      const fundingBox = this.page.getByLabel("How will this activity be funded?")
      await expect(fundingBox).toBeVisible()
      await this.page.getByRole("button", { name: "Continue" }).click()
      await expect(this.page.getByText("Choose at least one funding source.")).toBeVisible()
      await checkMulti(this.page, fundingBox, funding)
    } else {
      await this.expectFundingSourcesAbsent()
    }
    await this.page.getByRole("button", { name: "Continue" }).click()
    await expect(this.page.getByRole("heading", { name: "Student Activity Application Form" })).toBeVisible()
  }

  /** A no-budget paper never renders the funding-source multi-select. */
  async expectFundingSourcesAbsent() {
    await expect(this.page.getByLabel("How will this activity be funded?")).toHaveCount(0)
  }

  /**
   * Satisfy the event-setup T&C consent gate: tick the agreement checkbox
   * below the "Terms and conditions" button and assert it unlocks Continue.
   */
  async acceptSetupTerms() {
    const consent = this.page.getByRole("checkbox", {
      name: /I have read and agree to the Terms & Conditions/,
    })
    await expect(consent).toBeEnabled()
    await consent.click()
    await expect(this.page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled()
  }

  async classification(
    activity: "extra-curricular" | "co-curricular",
    nature: string[] = [],
  ) {
    const label = activity === "extra-curricular" ? "Extra-curricular Activity" : "Co-curricular Activity"
    await this.page.getByRole("radio", { name: label }).check()
    await stepPanel(this.page).locator("[name='totalOrgMembers']").fill("40")
    // S-2: nature of activity is a separate multi-select (not the OSAAR major/minor).
    for (const option of nature) {
      await stepPanel(this.page).locator(`input[name='activityNature'][value='${option}']`).check()
    }
    await this.continue()
  }

  async people(email: string, options: { campus: string; stay?: boolean }) {
    const panel = stepPanel(this.page)
    // The People step starts with an empty roster panel (test orgs have no saved
    // officers), so the proponent card only exists after "Add Proponent
    // Manually". Click it when no card is on screen yet.
    if ((await panel.getByPlaceholder("First Name").count()) === 0) {
      await panel.getByRole("button", { name: "Add Proponent Manually" }).click()
    }
    await panel.getByPlaceholder("First Name").fill("Ana")
    await panel.getByPlaceholder("Last Name").fill("Reyes")
    await panel.getByPlaceholder("202XXXXXXX").fill("2026100101")
    // S-7: the officer picks their own campus → department → program cascade
    // (no longer locked to the organization's department).
    await choose(this.page, panel.getByRole("combobox", { name: "Campus" }), options.campus)
    await expect(panel.getByRole("combobox", { name: "Department" })).toBeEnabled()
    await choose(this.page, panel.getByRole("combobox", { name: "Department" }), /School of Information Technology/)
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

  /**
   * S-6 participant split: fill the Mapuan count, and when a non-Mapua count is
   * given, flip the switch, fill it, and assert the payment note + derived total.
   * `expectedParticipants` is derived (mapua + non-Mapua), never a direct input.
   */
  async participants(mapua: number, nonMapua?: number) {
    const panel = stepPanel(this.page)
    await panel.locator("[name='mapuaParticipants']").fill(String(mapua))
    if (nonMapua !== undefined && nonMapua > 0) {
      await panel.getByRole("switch", { name: /non-Mapuan participants/i }).click()
      const extra = panel.locator("[name='nonMapuaParticipants']")
      await expect(extra).toBeVisible()
      await extra.fill(String(nonMapua))
      await expect(
        panel.getByText(/Non-Mapuan participants may be subject to payment requirements/),
      ).toBeVisible()
      await expect(
        panel.getByText(`Total expected participants: ${mapua + nonMapua}`),
      ).toBeVisible()
    }
  }

  /** Pick the campus, the event date, and one free slot on the reservation step. */
  async schedule(campus: string, slot: number) {
    const panel = stepPanel(this.page)
    await this.participants(40)
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
    await panel.locator("[name='mapuaParticipants']").fill(String(headcount))
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
    // S-8: outside equipment (not from Mapua) is a free-list CDM must rule on.
    if (pick.outside?.length) {
      for (let index = 0; index < pick.outside.length; index += 1) {
        const item = pick.outside[index]
        await panel.getByRole("button", { name: "Add outside equipment" }).click()
        await panel.getByLabel(`Outside equipment ${index + 1} name`).fill(item.name)
        if (item.purpose) {
          await panel.getByLabel(`Outside equipment ${index + 1} purpose`).fill(item.purpose)
        }
      }
      await panel
        .getByText(/I acknowledge that the outside equipment listed above is subject to CDM/)
        .click()
    }
    await this.continue()
  }

  async expectEquipmentBlocked(campus: string, slot: number) {
    await this.schedule(campus, slot)
    await expect(stepPanel(this.page).getByText("Reserve at least one room on the left first.")).toBeVisible()
  }

  async activityOnline(campusOnline = "Online", budget = true, nonMapua?: number) {
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
    await this.participants(40, nonMapua)
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
    // A with-budget paper must carry a budget note before it can leave the step.
    await panel.getByLabel("Budget Note").fill(BUDGET_NOTE)
  }

  /** A no-budget paper never renders the line-item table or the money inputs. */
  async expectBudgetAbsent() {
    const panel = stepPanel(this.page)
    await expect(panel.getByRole("combobox", { name: "Budget item" })).toHaveCount(0)
    await expect(this.page.getByPlaceholder("0.00")).toHaveCount(0)
    await expect(panel.getByLabel("Budget Note")).toHaveCount(0)
    await expect(this.page.getByText("Alignment & budget")).toHaveCount(0)
  }

  async submit() {
    await this.page.getByRole("button", { name: "Submit", exact: true }).click()
    // The RA 10173 gate: Proceed stays disabled until the notice is ticked, and
    // the label names a version only once the backend notice has loaded.
    const proceed = this.page.getByRole("button", { name: "Proceed" })
    await expect(proceed).toBeDisabled()
    // Click the checkbox itself, not the label span: the notice ScrollArea
    // panel overlaps the label text and intercepts pointer events there.
    const consent = this.page.getByRole("checkbox", {
      name: /I have read and agree to the Data Privacy Act of 2012 \(RA 10173\) notice \(v/,
    })
    await expect(consent).toBeVisible()
    await consent.click()
    // T&C acceptance lives on the event-setup gate only; the confirm dialog
    // gates Proceed on the privacy tick alone.
    await expect(proceed).toBeEnabled()
    await proceed.click()
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
  await expect(dialog.getByText(/SAAF-\d{6}-\d{3}/).first()).toBeVisible()
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

/**
 * Open a filed paper's tracker on Document Details and read the recorded
 * RA 10173 consent line, e.g. "Data privacy consent v1.0 accepted <Manila>".
 */
export async function trackerConsent(page: Page, title: string): Promise<string> {
  await page.goto("/students/dashboard")
  await page.getByRole("region", { name: "Proposal statistics filters" }).getByLabel("Search records").fill(title)
  await page.locator("tr").filter({ hasText: title }).first().click()
  const dialog = page.getByRole("dialog", { name: `${title} Proposal` })
  await dialog.getByRole("button", { name: "Document Details", exact: true }).click()
  const row = dialog.getByText("Data privacy consent", { exact: true }).locator("xpath=..")
  await expect(row).toBeVisible()
  const text = (await row.innerText()).replace(/\s+/g, " ").trim()
  await dialog.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  return text
}

/**
 * Open a decided paper's tracker on Milestone & Progress and read the overall
 * turnaround line plus every per-desk "<duration> on desk" suffix. `total` is
 * null until the paper is fully approved.
 */
export async function trackerTurnaround(
  page: Page,
  title: string,
): Promise<{ total: string | null; deskDurations: string[] }> {
  await page.goto("/students/dashboard")
  await page.getByRole("region", { name: "Proposal statistics filters" }).getByLabel("Search records").fill(title)
  await page.locator("tr").filter({ hasText: title }).first().click()
  const dialog = page.getByRole("dialog", { name: `${title} Proposal` })
  await dialog.getByRole("button", { name: "Milestone & Progress" }).click()
  const totalLine = dialog.getByText(/Total time to final approval/)
  const total =
    (await totalLine.count()) > 0
      ? (await totalLine.first().innerText()).replace(/\s+/g, " ").trim()
      : null
  const desks = await dialog.getByText(/on desk/).allTextContents()
  await dialog.getByRole("button", { name: "Close", exact: true }).filter({ hasText: "Close" }).click()
  return { total, deskDurations: desks.map((text) => text.replace(/\s+/g, " ").trim()) }
}

export function rolesMatch(actual: string[], expected: string[]) {
  expect(actual.map(normalizeDesk)).toEqual(expected.map(normalizeDesk))
}
