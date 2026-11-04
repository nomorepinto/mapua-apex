import { test } from "@playwright/test"

import { MembersPage } from "../pages/members.page"
import { openApex } from "../support/auth"

const NUMBER = "2026900001"

test("an org builds and trims its member roster", async ({ browser }) => {
  const session = await openApex(browser, "orgA")
  const members = new MembersPage(session.page)
  try {
    await members.open()
    await members.addMember("Reyes", "Juan", NUMBER)
    await members.expectDuplicateRejected(NUMBER)
    await members.editMember(NUMBER, "Santos", "Maria")
    await members.removeMember(NUMBER)
  } finally {
    await session.close()
  }
})
