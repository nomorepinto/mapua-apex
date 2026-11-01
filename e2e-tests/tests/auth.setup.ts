import { test } from "@playwright/test"

import { signInAndSaveApex } from "../support/auth"

test("admin signs in through the landing dialog", async ({ browser }) => {
  await signInAndSaveApex(browser, "admin")
})
