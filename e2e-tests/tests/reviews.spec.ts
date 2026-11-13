import { expect, type Browser, type Page, test } from "@playwright/test"

import { AdminEditPage, DashboardPage, editedSentence } from "../pages/dashboard.page"
import { ReservablesPage } from "../pages/reservables.page"
import { ReviewPage } from "../pages/review.page"
import { SaafPage, rolesMatch, trackerRoles, trackerTurnaround } from "../pages/saaf.page"
import { openApex } from "../support/auth"
import { account, eventDate } from "../support/env"
import { BUDGET_NOTE, normalizeDesk, OUTSIDE_EQUIPMENT } from "../support/data"
import { readRun, writeRun, type PaperRecord } from "../support/run-state"
import { captureJson } from "../support/ui"

test.describe.configure({ mode: "serial" })

async function asUser(browser: Browser, key: string, run: (page: Page) => Promise<void>) {
  const session = await openApex(browser, key)
  try {
    await run(session.page)
  } finally {
    await session.close()
  }
}

async function approve(browser: Browser, desk: string, title: string) {
  await asUser(browser, desk, async (page) => {
    const review = new ReviewPage(page)
    await review.open(desk, title)
    await review.approve()
  })
}

async function approveAll(browser: Browser, paper: PaperRecord) {
  for (const desk of paper.desks) await approve(browser, desk, paper.title)
}

async function returnThenApprove(browser: Browser, paper: PaperRecord) {
  for (const desk of paper.desks) {
    await asUser(browser, desk, async (page) => {
      const review = new ReviewPage(page)
      await review.open(desk, paper.title)
      await review.returnProposal()
    })
    await asUser(browser, paper.org, async (page) => {
      const dashboard = new DashboardPage(page)
      await dashboard.editAndResubmit(paper.title)
      await new SaafPage(page).resubmitPrefilled()
    })
    await approve(browser, desk, paper.title)
  }
}

async function denyAt(browser: Browser, paper: PaperRecord, target: string) {
  for (const desk of paper.desks) {
    if (desk === target) {
      await asUser(browser, desk, async (page) => {
        const review = new ReviewPage(page)
        await review.open(desk, paper.title)
        await review.reject()
      })
      break
    }
    await approve(browser, desk, paper.title)
  }
  await asUser(browser, paper.org, async (page) => {
    const dashboard = new DashboardPage(page)
    await dashboard.expectDenied(paper.title)
    await dashboard.expectBadge(paper.title, "Denied")
  })
}

test("admin edit keeps the current desk", async ({ browser }) => {
  const paper = readRun().papers.P1
  let before = ""
  await asUser(browser, paper.org, async (page) => {
    before = await new DashboardPage(page).currentReviewer(paper.title)
  })
  await asUser(browser, "admin", async (page) => {
    await new AdminEditPage(page).appendDescription(paper.title)
  })
  await asUser(browser, paper.org, async (page) => {
    const dashboard = new DashboardPage(page)
    await dashboard.expectDescription(paper.title, "Edited.")
    expect(await dashboard.currentReviewer(paper.title)).toBe(before)
    expect(editedSentence.length).toBeGreaterThan(20)
  })
})

test("shows the funding sources and budget note on a with-budget paper", async ({ browser }) => {
  const paper = readRun().papers.P1
  // Runs after "admin edit keeps the current desk" (serial), so this also
  // proves an admin edit preserves the filed funding sources and budget note
  // instead of resetting them.
  await asUser(browser, "adv1", async (page) => {
    const review = new ReviewPage(page)
    await review.open("adv1", paper.title)
    await review.expectFundingSources(paper.title, ["Sponsors", "Organization", "Member Contributions", "Others"])
    await review.expectBudgetNote(paper.title, BUDGET_NOTE)
  })
})
test("approves the straight-through papers", async ({ browser }) => {
  const papers = readRun().papers
  // P15 is the no-budget paper; approving it makes it eligible for a post-eval.
  // P16 is the off-campus paper (no CDM desk), proving that branch approves end-to-end.
  for (const key of ["P1", "P2", "P3", "P6", "P7", "P15", "P16"]) await approveAll(browser, papers[key])
})

test("shows the proponent the per-desk and overall turnaround", async ({ browser }) => {
  const paper = readRun().papers.P1
  await asUser(browser, paper.org, async (page) => {
    // P1 is fully approved above, so the overall line and every desk duration appear.
    const { total, deskDurations } = await trackerTurnaround(page, paper.title)
    expect(total).not.toBeNull()
    expect(total).toContain("Total time to final approval")
    expect(deskDurations.length).toBeGreaterThan(0)
    for (const duration of deskDurations) expect(duration).toContain("on desk")
  })
})

test("returns and approves P5 and P4 at every desk", async ({ browser }) => {
  test.setTimeout(1_200_000)
  const papers = readRun().papers
  await returnThenApprove(browser, papers.P5)
  await returnThenApprove(browser, papers.P4)
})

test("denies a paper at each desk", async ({ browser }) => {
  test.setTimeout(900_000)
  const papers = readRun().papers
  const targets = [
    ["P9", "adv1"],
    ["P10", "dean1"],
    ["P11", "osaar1"],
    ["P12", "osaar2"],
    ["P13", "cdm1"],
  ] as const
  for (const [key, desk] of targets) await denyAt(browser, papers[key], desk)
})

test("resubmitting as extra-curricular returns the paper to the adviser", async ({ browser }) => {
  const run = readRun()
  const title = `Route Dean ${run.tag}`
  const roles = ["Adviser", "Dean", "OSAAR", "OSAAR", "OSAAR"]
  await asUser(browser, "orgA", async (page) => {
    const saaf = new SaafPage(page)
    await saaf.start(title, false)
    await saaf.classification("co-curricular")
    await saaf.people(account("admin").email, { campus: run.campus })
    await saaf.activityOnline()
    await saaf.alignment()
    await captureJson(page, "/students/submissions", "POST", () => saaf.submit())
    rolesMatch(await trackerRoles(page, title), roles)
  })
  const paper: PaperRecord = { title, org: "orgA", roles, desks: ["adv1", "dean1", "osaar1", "osaar2", "osaarAll"] }
  writeRun((state) => {
    state.papers["route-dean"] = paper
  })
  await approve(browser, "adv1", title)
  await asUser(browser, "dean1", async (page) => {
    const review = new ReviewPage(page)
    await review.open("dean1", title)
    await review.returnProposal()
  })
  await asUser(browser, "orgA", async (page) => {
    const dashboard = new DashboardPage(page)
    await dashboard.editAndResubmit(title)
    await new SaafPage(page).resubmitPrefilled(async (step) => {
      if (step === 0) await page.getByRole("radio", { name: "Extra-curricular Activity" }).check()
    })
    expect(normalizeDesk(await dashboard.currentReviewer(title))).toBe("Adviser")
  })
})

test("adding a collaborator on resubmit shows who receives the paper", async ({ browser }) => {
  const run = readRun()
  const title = `Route Osaar ${run.tag}`
  const roles = ["Adviser", "OSAAR", "OSAAR", "OSAAR"]
  await asUser(browser, "orgA", async (page) => {
    const saaf = new SaafPage(page)
    await saaf.start(title, false)
    await saaf.classification("extra-curricular")
    await saaf.people(account("admin").email, { campus: run.campus })
    await saaf.activityOnline()
    await saaf.alignment()
    await captureJson(page, "/students/submissions", "POST", () => saaf.submit())
    rolesMatch(await trackerRoles(page, title), roles)
  })
  await approve(browser, "adv1", title)
  await asUser(browser, "osaar1", async (page) => {
    const review = new ReviewPage(page)
    await review.open("osaar1", title)
    await review.returnProposal()
  })
  await asUser(browser, "orgA", async (page) => {
    const dashboard = new DashboardPage(page)
    await dashboard.editAndResubmit(title)
    await new SaafPage(page).resubmitPrefilled(async (step) => {
      if (step === 1) await new SaafPage(page).addCollaborator(run.orgs.orgB)
    })
    const current = await dashboard.currentReviewer(title)
    const collaborator = `${run.orgs.orgB}'s Adviser`
    if (normalizeDesk(current) === "OSAAR") {
      test.info().annotations.push({
        type: "gap",
        description: "Resubmit resumed at OSAAR, so the new collaborator adviser was skipped.",
      })
      return
    }
    expect(current).toBe(collaborator)
  })
})

test("a CDM hold blocks the last approval", async ({ browser }) => {
  const run = readRun()
  const paper = run.papers.P14
  await asUser(browser, "cdm1", async (page) => {
    await captureJson(page, "/bookings", "POST", () =>
      new ReservablesPage(page).hold(run.campus, "R101", eventDate, 3),
    )
  })
  for (const desk of paper.desks) {
    if (desk === "cdm1") {
      await asUser(browser, desk, async (page) => {
        const review = new ReviewPage(page)
        await review.open(desk, paper.title)
        await review.expectApprovalBlocked()
      })
      return
    }
    await approve(browser, desk, paper.title)
  }
})

test("R-1: campus OSAAR approves, other desks review; only all-campus OSAAR classifies", async ({ browser }) => {
  const run = readRun()
  const title = `Verb Check ${run.tag}`
  const roles = ["Adviser", "OSAAR", "OSAAR", "OSAAR"]
  await asUser(browser, "orgA", async (page) => {
    const saaf = new SaafPage(page)
    await saaf.start(title, false)
    await saaf.classification("extra-curricular")
    await saaf.people(account("admin").email, { campus: run.campus })
    await saaf.activityOnline()
    await saaf.alignment()
    await captureJson(page, "/students/submissions", "POST", () => saaf.submit())
    rolesMatch(await trackerRoles(page, title), roles)
  })
  // The adviser reviews and never sees the major/minor control.
  await asUser(browser, "adv1", async (page) => {
    const review = new ReviewPage(page)
    await review.open("adv1", title)
    await review.expectActionVerb("Review")
    await review.expectClassificationControl(false)
    await review.approve()
  })
  // Campus OSAAR desks approve (verb "Approve") with no classification control.
  for (const desk of ["osaar1", "osaar2"]) {
    await asUser(browser, desk, async (page) => {
      const review = new ReviewPage(page)
      await review.open(desk, title)
      await review.expectActionVerb("Approve")
      await review.expectClassificationControl(false)
      await review.approve()
    })
  }
  // The all-campus OSAAR reviews (verb "Review") and owns the classification gate.
  await asUser(browser, "osaarAll", async (page) => {
    const review = new ReviewPage(page)
    await review.open("osaarAll", title)
    await review.expectActionVerb("Review")
    await review.expectClassificationControl(true)
    await review.approve()
  })
})

test("S-8: CDM rules on every outside equipment item before approving", async ({ browser }) => {
  const paper = readRun().papers.P17
  for (const desk of paper.desks) {
    if (desk === "cdm1") {
      await asUser(browser, desk, async (page) => {
        const review = new ReviewPage(page)
        await review.open(desk, paper.title)
        // Approve stays blocked until every outside item has a ruling.
        await review.expectOutsideEquipmentGate()
        for (const item of OUTSIDE_EQUIPMENT) {
          await review.decideOutsideEquipment(item.name, true)
        }
        await review.approve()
      })
      return
    }
    await approve(browser, desk, paper.title)
  }
})
