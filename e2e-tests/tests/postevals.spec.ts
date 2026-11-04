import { expect, test } from "@playwright/test"

import { DashboardPage } from "../pages/dashboard.page"
import { OsaarPostevalPage, PostevalPage } from "../pages/posteval.page"
import { openApex } from "../support/auth"
import { skipDayOf } from "../support/env"
import { readRun } from "../support/run-state"

test.describe.configure({ mode: "serial" })

test.beforeEach(() => {
  test.skip(skipDayOf, "event date is not today")
})

test("council events are not offered for a post-evaluation", async ({ browser }) => {
  const run = readRun()
  const org = await openApex(browser, "orgA")
  try {
    const posteval = new PostevalPage(org.page)
    await posteval.expectEventAbsent(run.papers.P6.title)
    await posteval.expectEventAbsent(run.papers.P7.title)
  } finally {
    await org.close()
  }
  const council = await openApex(browser, "orgC")
  try {
    await new PostevalPage(council.page).expectCouncilGate()
  } finally {
    await council.close()
  }
})

test("OSAAR approves P2 and the student badge stays pending", async ({ browser }) => {
  const paper = readRun().papers.P2
  const org = await openApex(browser, "orgA")
  try {
    await new PostevalPage(org.page).file(paper.title)
  } finally {
    await org.close()
  }
  const osaar = await openApex(browser, "osaar1")
  try {
    const review = new OsaarPostevalPage(osaar.page)
    await review.open(paper.title)
    await expectNoReturn(osaar.page)
    await review.approve()
  } finally {
    await osaar.close()
  }
  const student = await openApex(browser, "orgA")
  try {
    await new DashboardPage(student.page).expectBadge(paper.title, "Pending")
  } finally {
    await student.close()
  }
  const again = await openApex(browser, "osaar1")
  try {
    const review = new OsaarPostevalPage(again.page)
    await review.open(paper.title)
    await review.expectNoReturnOrDeny()
  } finally {
    await again.close()
  }
  const duplicate = await openApex(browser, "orgA")
  try {
    await new PostevalPage(duplicate.page).expectEventAbsent(paper.title)
  } finally {
    await duplicate.close()
  }
})

test("a no-budget submission files a post-eval without the financial step", async ({ browser }) => {
  const paper = readRun().papers.P15
  const org = await openApex(browser, "orgA")
  try {
    await new PostevalPage(org.page).file(paper.title, { noBudget: true })
  } finally {
    await org.close()
  }
})

test("a denied post-evaluation can be filed again", async ({ browser }) => {
  const paper = readRun().papers.P3
  const org = await openApex(browser, "orgA")
  try {
    await new PostevalPage(org.page).file(paper.title)
  } finally {
    await org.close()
  }
  const osaar = await openApex(browser, "osaar1")
  try {
    const review = new OsaarPostevalPage(osaar.page)
    await review.open(paper.title)
    await review.deny()
  } finally {
    await osaar.close()
  }
  const refile = await openApex(browser, "orgA")
  try {
    await new PostevalPage(refile.page).file(paper.title)
  } finally {
    await refile.close()
  }
  const approve = await openApex(browser, "osaar1")
  try {
    const review = new OsaarPostevalPage(approve.page)
    await review.open(paper.title)
    await review.approve()
  } finally {
    await approve.close()
  }
})

async function expectNoReturn(page: import("@playwright/test").Page) {
  await expect(page.getByRole("button", { name: "Return", exact: true })).toHaveCount(0)
}
