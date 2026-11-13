import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Landing account-creation dialog and its Terms & Conditions consent gate.
 * The flow is public (no sign-in) and the spec never submits, so it creates no
 * Cognito user and no DynamoDB item — nothing to record on the run manifest or
 * clean up. The full versioned notices (T&C + RA 10173 privacy notice) live
 * behind a "Terms and conditions" button that opens a scrollable dialog; a
 * single agreement checkbox below it gates Create account until both notices
 * have loaded and the box is ticked.
 */
export class SignupPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/")
    await this.page.getByRole("button", { name: "Sign In", exact: true }).click()
    const signIn = this.page.getByRole("dialog", { name: "Welcome back" })
    await signIn.getByRole("button", { name: "Create an account" }).click()
    await expect(this.dialog()).toBeVisible()
  }

  dialog(): Locator {
    return this.page.getByRole("dialog", { name: "Create your account" })
  }

  createButton(): Locator {
    return this.dialog().getByRole("button", { name: "Create account", exact: true })
  }

  termsButton(): Locator {
    return this.dialog().getByRole("button", { name: "Terms and conditions" })
  }

  consentCheckbox(): Locator {
    return this.dialog().getByRole("checkbox", {
      name: /I have read and agree to the Terms & Conditions/,
    })
  }

  termsDialog(): Locator {
    return this.page.getByRole("dialog", { name: "Terms & Conditions" })
  }

  /** The notices are fetched on mount; the checkbox unlocks once both load. */
  async expectNoticesLoaded() {
    await expect(this.consentCheckbox()).toBeEnabled()
  }

  async openTermsDialog() {
    await this.termsButton().click()
    await expect(this.termsDialog()).toBeVisible()
  }

  async closeTermsDialog() {
    await this.termsDialog().getByRole("button", { name: "Close", exact: true }).click()
    await expect(this.termsDialog()).toBeHidden()
  }

  async acceptTerms() {
    await this.consentCheckbox().click()
  }

  async revokeTerms() {
    await this.consentCheckbox().click()
  }
}
