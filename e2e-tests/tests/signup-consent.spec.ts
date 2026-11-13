import { expect, test } from "@playwright/test"

import { SignupPage } from "../pages/signup.page"

// Public landing account-creation flow. The spec never submits the form, so it
// creates no Cognito user and no DynamoDB item — nothing to record on the run
// manifest or clean up. It asserts the consent gate added alongside the SAAF
// Terms & Conditions: Create account stays disabled until the privacy notice
// and every T&C acknowledgement are accepted.
test("account creation is gated behind the Terms & Conditions and privacy notice", async ({ page }) => {
  const signup = new SignupPage(page)
  await signup.open()

  const create = signup.createButton()
  await signup.expectNoticesLoaded()
  await expect(create).toBeDisabled()

  // Privacy consent alone does not unlock creation — the T&C still blocks.
  await signup.acceptPrivacy()
  await expect(create).toBeDisabled()

  // Every T&C acknowledgement (privacy already ticked) unlocks creation.
  await signup.acceptTerms()
  await expect(create).toBeEnabled()

  // Revoking any acknowledgement re-blocks creation.
  await signup.uncheckFirstTerms()
  await expect(create).toBeDisabled()
})
