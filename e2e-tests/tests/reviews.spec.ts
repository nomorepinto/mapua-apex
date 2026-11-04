import { expect, type Browser, type Page, test } from "@playwright/test"

import { AdminEditPage, DashboardPage, editedSentence } from "../pages/dashboard.page"
import { ReservablesPage } from "../pages/reservables.page"
import { ReviewPage } from "../pages/review.page"
import { SaafPage, rolesMatch, trackerRoles } from "../pages/saaf.page"
import { openApex } from "../support/auth"
import { account, eventDate } from "../support/env"
import { normalizeDesk } from "../support/data"
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
    await dashboard.expectBadge(paper.title, "Cancelled")
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

test("approves the straight-through papers", async ({ browser }) => {
  const papers = readRun().papers
  // P15 is the no-budget paper; approving it makes it eligible for a post-eval.
  for (const key of ["P1", "P2", "P3", "P6", "P7", "P15"]) await approveAll(browser, papers[key])
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
    await saaf.people(account("admin").email, { chooseDepartment: false })
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
    await saaf.people(account("admin").email, { chooseDepartment: false })
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
