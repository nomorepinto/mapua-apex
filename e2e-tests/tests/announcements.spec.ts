import { test } from "@playwright/test"

import { AnnouncementsPage } from "../pages/announcements.page"
import { openApex } from "../support/auth"
import { tag } from "../support/env"

test("OSAAR posts, edits, and removes an announcement", async ({ browser }) => {
  const marker = `Notice ${tag}`
  const createContent = `${marker} office hours will shift earlier this week for every organization.`
  const editContent = `${marker} office hours now close at four in the afternoon for every organization.`
  const session = await openApex(browser, "osaar1")
  const announcements = new AnnouncementsPage(session.page)
  try {
    await announcements.open()
    await announcements.create(marker, createContent)
    await announcements.edit(marker, editContent)
    await announcements.remove(marker)
  } finally {
    await session.close()
  }
})
