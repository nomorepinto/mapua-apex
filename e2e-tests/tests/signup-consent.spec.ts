import { expect, test } from "@playwright/test"

import { SignupPage } from "../pages/signup.page"

// Public landing account-creation flow. The spec never submits the form, so it
// creates no Cognito user and no DynamoDB item — nothing to record on the run
// manifest or clean up. It asserts the rebuilt consent gate: the full Terms &
// Conditions (+ privacy notice) text opens in a scrollable dialog from the
// "Terms and conditions" button, with the single agreement checkbox placed at
// the very bottom of that text. Create account stays disabled until it is
// ticked.
test("account creation is gated behind the Terms & Conditions consent", async ({ page }) => {
  const signup = new SignupPage(page)
  await signup.open()

  const create = signup.createButton()
  await expect(create).toBeDisabled()

  // The button opens the complete notice text in a scrollable dialog.
  await signup.openTermsDialog()
  await expect(signup.termsDialog()).toContainText("Turnaround time")
  await expect(signup.termsDialog()).toContainText("Acknowledgements")
  await expect(signup.termsDialog()).toContainText("Your rights")

  // Reading alone does not unlock creation — the agreement at the bottom of
  // the text must be ticked (clicking auto-scrolls the dialog to reach it).
  await expect(create).toBeDisabled()
  await signup.acceptTerms()
  await signup.closeTermsDialog()
  await expect(create).toBeEnabled()

  // Reopening keeps the tick visible; revoking it re-blocks creation.
  await signup.openTermsDialog()
  await expect(signup.consentCheckbox()).toBeChecked()
  await signup.revokeTerms()
  await signup.closeTermsDialog()
  await expect(create).toBeDisabled()
})
