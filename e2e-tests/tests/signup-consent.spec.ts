import { expect, test } from "@playwright/test"

import { SignupPage } from "../pages/signup.page"

// Public landing account-creation flow. The spec never submits the form, so it
// creates no Cognito user and no DynamoDB item — nothing to record on the run
// manifest or clean up. It asserts the rebuilt consent gate: the full Terms &
// Conditions (+ privacy notice) text opens in a scrollable dialog from the
// "Terms and conditions" button, and Create account stays disabled until the
// single agreement checkbox is ticked.
test("account creation is gated behind the Terms & Conditions consent", async ({ page }) => {
  const signup = new SignupPage(page)
  await signup.open()

  const create = signup.createButton()
  await signup.expectNoticesLoaded()
  await expect(create).toBeDisabled()

  // The button opens the complete notice text in a scrollable dialog.
  await signup.openTermsDialog()
  await expect(signup.termsDialog()).toContainText("Turnaround time")
  await expect(signup.termsDialog()).toContainText("Acknowledgements")
  await expect(signup.termsDialog()).toContainText("Your rights")
  await signup.closeTermsDialog()

  // Reading alone does not unlock creation — the agreement checkbox does.
  await expect(create).toBeDisabled()

  // Ticking the single acknowledgement unlocks creation.
  await signup.acceptTerms()
  await expect(create).toBeEnabled()

  // Revoking the tick re-blocks creation.
  await signup.revokeTerms()
  await expect(create).toBeDisabled()
})
