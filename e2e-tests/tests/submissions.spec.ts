import { test } from "@playwright/test"

import { SaafPage, rolesMatch, trackerRoles, type ReservationPick } from "../pages/saaf.page"
import { openApex } from "../support/auth"
import { account } from "../support/env"
import { readRun, writeRun, type PaperRecord } from "../support/run-state"
import { captureJson } from "../support/ui"

type PaperDraft = PaperRecord & {
  key: string
  activity: "extra-curricular" | "co-curricular"
  reserve: boolean
  budget?: boolean
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
    { key: "P1", title: `Extra Online ${run.tag}`, org: "orgA", roles: extra, desks: ["adv1", "osaar1", "osaar2", "osaarAll"], activity: "extra-curricular", reserve: false },
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
    await saaf.start(paper.title, paper.reserve, budget)
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
})
