import { expect, test } from "@playwright/test"

import {
  SaafPage,
  rolesMatch,
  trackerConsent,
  trackerRoles,
  trackerSignatories,
  type ReservationPick,
} from "../pages/saaf.page"
import { openApex } from "../support/auth"
import { DESK_CONTACT } from "../support/data"
import { account } from "../support/env"
import { readRun, writeRun, type PaperRecord } from "../support/run-state"
import { captureJson } from "../support/ui"

type PaperDraft = PaperRecord & {
  key: string
  activity: "extra-curricular" | "co-curricular"
  reserve: boolean
  budget?: boolean
  funding?: string[]
  pick?: Omit<ReservationPick, "campus">
  collaborators?: string[]
  higherCouncil?: boolean
}

test.describe.configure({ mode: "serial" })

function drafts(): PaperDraft[] {
  const run = readRun()
  const room = (slot: number, name: string): Omit<ReservationPick, "campus"> => ({ room: name, slot })
  const both = (slot: number): Omit<ReservationPick, "campus"> => ({
    room: "Auditorium",
    equipment: "Projector",
    slot,
  })
  const extra = ["Adviser", "OSAAR", "OSAAR", "OSAAR"]
  const extraRoom = [...extra, "CDM"]
  const co = ["Adviser", "Dean", "OSAAR", "OSAAR", "OSAAR"]
  const coRoom = [...co, "CDM"]
  const collab = [
    `${run.orgs.orgA}'s Adviser`,
    `${run.orgs.orgB}'s Adviser`,
    `${run.orgs.orgA}'s Dean`,
    `${run.orgs.orgB}'s Dean`,
    "OSAAR",
    "OSAAR",
    "OSAAR",
  ]
  const councilRoom = ["Adviser", "OSAAR", "OSAAR", "OSAAR", "CDM"]
  const councilCollab = [
    `${run.orgs.orgC}'s Adviser`,
    `${run.orgs.orgA}'s Adviser`,
    `${run.orgs.orgA}'s Dean`,
    "OSAAR",
    "OSAAR",
    "OSAAR",
  ]
  const papers: PaperDraft[] = [
    { key: "P1", title: `Extra Online ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false, funding: ["Sponsors", "Organization", "Member Contributions", "Others"] },
    { key: "P2", title: `Extra Room ${run.tag}`, org: "orgA", roles: extraRoom, desks: ["adv1", "osaar1", "osaar2", "osaarAll", "cdm1"], activity: "extra-curricular", reserve: true, pick: room(0, "R101") },
    { key: "P3", title: `Co Online ${run.tag}`, org: "orgA", roles: co, desks: ["adv1", "dean1", "osaar1", "osaar2", "osaarAll"], activity: "co-curricular", reserve: false },
    { key: "P4", title: `Co Room Equipment ${run.tag}`, org: "orgA", roles: coRoom, desks: ["adv1", "dean1", "osaar1", "osaar2", "osaarAll", "cdm1"], activity: "co-curricular", reserve: true, pick: both(2) },
    { key: "P5", title: `Co Collab ${run.tag}`, org: "orgA", roles: collab, desks: ["adv1", "adv2", "dean1", "dean2", "osaar1", "osaar2", "osaarAll"], activity: "co-curricular", reserve: false, collaborators: [run.orgs.orgB] },
    { key: "P6", title: `Council Room ${run.tag}`, org: "orgC", roles: councilRoom, desks: ["adv3", "osaar1", "osaar2", "osaarAll", "cdm1"], activity: "co-curricular", reserve: true, pick: room(1, "R101"), higherCouncil: true },
    { key: "P7", title: `Council Collab ${run.tag}`, org: "orgC", roles: councilCollab, desks: ["adv3", "adv1", "dean1", "osaar1", "osaar2", "osaarAll"], activity: "co-curricular", reserve: false, collaborators: [run.orgs.orgA], higherCouncil: true },
    { key: "P9", title: `Deny Adviser ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false },
    { key: "P10", title: `Deny Dean ${run.tag}`, org: "orgA", roles: co, desks: ["adv1", "dean1", "osaar1", "osaar2", "osaarAll"], activity: "co-curricular", reserve: false },
    { key: "P11", title: `Deny Osaar One ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false },
    { key: "P12", title: `Deny Osaar Two ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false },
    { key: "P13", title: `Deny Cdm ${run.tag}`, org: "orgA", roles: extraRoom, desks: ["adv1", "osaar1", "osaar2", "osaarAll", "cdm1"], activity: "extra-curricular", reserve: true, pick: room(4, "R101") },
    { key: "P14", title: `Conflict Hold ${run.tag}`, org: "orgA", roles: extraRoom, desks: ["adv1", "osaar1", "osaar2", "osaarAll", "cdm1"], activity: "extra-curricular", reserve: true, pick: room(3, "R101") },
    { key: "P15", title: `No Budget ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false, budget: false },
  ]
  return papers
}

async function file(browser: import("@playwright/test").Browser, paper: PaperDraft) {
  const run = readRun()
  const session = await openApex(browser, paper.org)
  const saaf = new SaafPage(session.page)
  const email = account("admin").email
  const budget = paper.budget !== false
  try {
    await saaf.start(paper.title, paper.reserve, budget, paper.funding)
    await saaf.classification(paper.activity)
    await saaf.people(email, { chooseDepartment: Boolean(paper.higherCouncil), stay: Boolean(paper.collaborators) })
    if (paper.collaborators) {
      for (const org of paper.collaborators) await saaf.addCollaborator(org)
      await saaf.continue()
    }
    if (paper.reserve && paper.pick) {
      await saaf.reservation({ campus: run.campus, ...paper.pick })
      await saaf.activityReserved(budget)
    } else {
      await saaf.activityOnline("Online", budget)
    }
    if (!budget) {
      // The alignment page must carry no budget UI at all for a no-budget paper.
      await saaf.alignment(false)
      await saaf.expectBudgetAbsent()
    } else {
      await saaf.alignment()
    }
    await captureJson(session.page, "/students/submissions", "POST", () => saaf.submit())
    const actual = await trackerRoles(session.page, paper.title)
    rolesMatch(actual, paper.roles)
    writeRun((state) => {
      state.papers[paper.key] = paper
    })
  } finally {
    await session.close()
  }
}

test.describe("submissions", () => {
  for (const paper of ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P9", "P10", "P11", "P12", "P13", "P14", "P15"]) {
    test(`files ${paper}`, async ({ browser }) => {
      const draft = drafts().find((item) => item.key === paper)
      if (!draft) throw new Error(paper)
      await file(browser, draft)
    })
  }

  test("blocks equipment without a room", async ({ browser }) => {
    const run = readRun()
    const session = await openApex(browser, "orgA")
    const saaf = new SaafPage(session.page)
    try {
      await saaf.start(`Equipment Only ${run.tag}`, true)
      await saaf.classification("extra-curricular")
      await saaf.people(account("admin").email, { chooseDepartment: false })
      await saaf.expectEquipmentBlocked(run.campus, 5)
    } finally {
      await session.close()
    }
  })

  test("suggests a room for the expected headcount", async ({ browser }) => {
    const run = readRun()
    const session = await openApex(browser, "orgA")
    const saaf = new SaafPage(session.page)
    try {
      await saaf.start(`Room Suggestion ${run.tag}`, true)
      await saaf.classification("extra-curricular")
      await saaf.people(account("admin").email, { chooseDepartment: false })
      // Slot 7 is left free by the filed papers, so both rooms are still offerable.
      await saaf.schedule(run.campus, 7)
      // R101 holds 10–80 and the Auditorium 20–200, so 40 ranks the tighter room first.
      await saaf.expectSuggestedRooms(40, ["R101", "Auditorium"])
      // Nothing holds 500, so the closest rooms are offered largest first, with the reason.
      await saaf.expectSuggestedRooms(500, ["Auditorium", "R101"], false)
      await saaf.expectSuggestedRooms(40, ["R101", "Auditorium"])
      await saaf.addSuggestedRoom("R101")
      // The one-click add is the dropdown's own path, so the picked room leaves the panel.
      await saaf.expectSuggestedRooms(40, ["Auditorium"])
    } finally {
      await session.close()
    }
  })

  test("shows the proponent the desks still to come and their contacts", async ({ browser }) => {
    const run = readRun()
    const paper = run.papers.P1
    if (!paper) throw new Error("P1")
    const session = await openApex(browser, "orgA")
    try {
      // P1 still sits on its adviser desk, so the tab lists that desk plus the three OSAAR stages.
      const desks = await trackerSignatories(session.page, paper.title, 4)
      expect(desks.map((desk) => desk.awaiting)).toEqual([true, false, false, false])
      expect(desks[0].text).toContain(run.people.adv1)
      expect(desks[0].email).toBe(`mailto:${DESK_CONTACT.email}`)
      expect(desks[0].text).toContain(DESK_CONTACT.office)
      expect(desks[0].text).toContain(DESK_CONTACT.number)
      for (const desk of desks.slice(1)) {
        expect(desk.email).toBe("")
        expect(desk.text).toContain("No contact details are on file for this desk.")
      }
    } finally {
      await session.close()
    }
  })

  test("records the proponent's data privacy consent on the paper", async ({ browser }) => {
    const run = readRun()
    const paper = run.papers.P1
    if (!paper) throw new Error("P1")
    const session = await openApex(browser, "orgA")
    try {
      // Filing ticks the RA 10173 gate, so the detail view names the accepted version.
      const consent = await trackerConsent(session.page, paper.title)
      expect(consent).toContain("Data privacy consent")
      expect(consent).toContain("accepted")
    } finally {
      await session.close()
    }
  })
})
