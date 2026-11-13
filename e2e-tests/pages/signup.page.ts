import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Landing account-creation dialog and its Terms & Conditions / Data Privacy
 * consent gate. The flow is public (no sign-in) and the spec never submits, so
 * it creates no Cognito user and no DynamoDB item — nothing to record on the run
 * manifest or clean up. The gate mirrors the SAAF pre-submit consent: Create
 * account stays disabled until the privacy notice and EVERY T&C acknowledgement
 * are ticked.
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

  private privacyCheckbox(): Locator {
    return this.dialog().getByRole("checkbox", {
      name: /I have read and agree to the Data Privacy Act of 2012 \(RA 10173\) notice \(v/,
    })
  }

  private termsCheckboxes(): Locator[] {
    return [
      /I understand that the standard turnaround time for activity approval is 2-3 working days\./,
      /I understand that applications must be filed between 7:00 AM and 3:00 PM/,
      /I understand the criteria for major and minor events/,
    ].map((name) => this.dialog().getByRole("checkbox", { name }))
  }

  async expectNoticesLoaded() {
    await expect(this.privacyCheckbox()).toBeVisible()
    for (const checkbox of this.termsCheckboxes()) {
      await expect(checkbox).toBeVisible()
    }
  }

  async acceptPrivacy() {
    await this.privacyCheckbox().click()
  }

  async acceptTerms() {
    for (const checkbox of this.termsCheckboxes()) {
      await checkbox.click()
    }
  }

  async uncheckFirstTerms() {
    await this.termsCheckboxes()[0].click()
  }
}
