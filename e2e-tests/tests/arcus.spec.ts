import { test, expect } from "@playwright/test"

import { AttendancePage, EvaluationPage } from "../pages/attendance.page"
import { openArcus, signInArcus } from "../support/auth"
import { STUDENT_NUMBERS } from "../support/data"
import { attendanceBase, evaluationBase, skipDayOf } from "../support/env"
import { rememberStudentNumber } from "../support/manifest"
import { readRun } from "../support/run-state"

test.describe.configure({ mode: "serial" })

test.beforeEach(() => {
  test.skip(skipDayOf, "event date is not today")
})

test("students register and the officer scans their codes", async ({ browser }) => {
  test.setTimeout(300_000)
  await rememberStudentNumber(STUDENT_NUMBERS.stu1)
  await rememberStudentNumber(STUDENT_NUMBERS.stu2)
  await rememberStudentNumber(STUDENT_NUMBERS.unregistered)
  for (const key of ["stu1", "stu2", "orgA"]) {
    await signInArcus(browser, "attendance", key)
  }

  for (const [key, number, first] of [
    ["stu1", STUDENT_NUMBERS.stu1, "Studentone"],
    ["stu2", STUDENT_NUMBERS.stu2, "Studenttwo"],
  ] as const) {
    const session = await openArcus(browser, "attendance", key)
    try {
      await new AttendancePage(session.page).register(first, "Reyes", number)
    } finally {
      await session.close()
    }
    await signInArcus(browser, "attendance", key)
  }

  const paper = readRun().papers.P2
  const officer = await openArcus(browser, "attendance", "orgA")
  const attendance = new AttendancePage(officer.page)
  try {
    await attendance.scanFile(STUDENT_NUMBERS.stu1, paper.title)
    await expect(officer.page.getByText(STUDENT_NUMBERS.stu1).first()).toBeVisible()
    await attendance.scanFile(STUDENT_NUMBERS.stu2, paper.title)
    await expect(officer.page.getByText(STUDENT_NUMBERS.stu2).first()).toBeVisible()
    await attendance.scanFile(STUDENT_NUMBERS.stu1, paper.title)
    await attendance.expectAlert(/Already checked in/)
    await attendance.scanFile(STUDENT_NUMBERS.unregistered, paper.title)
    await attendance.expectAlert(/not found|not registered/i)
    await attendance.membersOnly()
    await attendance.scanFile(STUDENT_NUMBERS.stu2, paper.title)
    await attendance.expectAlert(/Already checked in|not a member/i)
  } finally {
    await officer.close()
  }
})

test("a checked-in student files an evaluation", async ({ browser }) => {
  const paper = readRun().papers.P2
  const council = readRun().papers.P6
  await signInArcus(browser, "evaluation", "stu1")
  await signInArcus(browser, "evaluation", "orgA")
  const student = await openArcus(browser, "evaluation", "stu1")
  try {
    await new EvaluationPage(student.page).file(paper.title)
    await new EvaluationPage(student.page).expectEventAbsent(council.title)
  } finally {
    await student.close()
  }
  const officer = await openArcus(browser, "evaluation", "orgA")
  try {
    await new EvaluationPage(officer.page).expectAttendance(paper.title)
  } finally {
    await officer.close()
  }
  expect(attendanceBase).not.toBe(evaluationBase)
})
