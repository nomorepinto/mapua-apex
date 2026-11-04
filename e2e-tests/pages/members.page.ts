import { expect, type Page } from "@playwright/test"

/**
 * Org roster at `/students/members`. Items are keyed under the JWT org's
 * `ORGANIZATION#{org_id}` partition, so the run manifest already cleans them
 * through the recorded org id. The round trip here (add → edit → remove) is
 * self-cleaning regardless.
 */
export class MembersPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/students/members")
    await expect(this.page.getByText("Organization members")).toBeVisible()
    // Let the roster query settle before typing: the add form is a set of
    // controlled inputs, and filling during the initial hydration can race the
    // first commit and submit an empty form.
    await expect(this.page.getByText("Loading…")).toBeHidden()
  }

  private row(number: string) {
    return this.page.getByRole("row").filter({ hasText: number })
  }

  /** Fill a controlled field and confirm it committed, re-filling once if a
   *  hydration re-render cleared it, so a submit never sees an empty field. */
  private async setField(label: string, value: string) {
    const field = this.page.getByLabel(label)
    await field.fill(value)
    if ((await field.inputValue()) !== value) await field.fill(value)
    await expect(field).toHaveValue(value)
  }

  async addMember(lastname: string, firstname: string, number: string) {
    await this.setField("Last name", lastname)
    await this.setField("First name", firstname)
    await this.setField("Student number", number)
    await this.page.getByRole("button", { name: "Add member", exact: true }).click()
    await expect(this.row(number)).toBeVisible()
  }

  async expectDuplicateRejected(number: string) {
    await this.setField("Last name", "Dela Cruz")
    await this.setField("First name", "Juan")
    await this.setField("Student number", number)
    await this.page.getByRole("button", { name: "Add member", exact: true }).click()
    // The client-side duplicate guard flags the student-number field invalid
    // (aria-invalid) and refuses the add; the roster keeps exactly one row for
    // the number, so the duplicate never lands.
    await expect(this.page.getByLabel("Student number")).toHaveAttribute("aria-invalid", "true")
    await expect(this.row(number)).toHaveCount(1)
  }

  async expectMember(number: string, lastname: string, firstname: string) {
    const row = this.row(number)
    await expect(row).toBeVisible()
    await expect(row.getByText(lastname, { exact: true })).toBeVisible()
    await expect(row.getByText(firstname, { exact: true })).toBeVisible()
  }

  private async openEdit(number: string) {
    await this.row(number).getByRole("button", { name: "Edit" }).click()
    await expect(this.page.getByRole("dialog", { name: "Edit member" })).toBeVisible()
  }

  async editMember(number: string, lastname: string, firstname: string) {
    await this.openEdit(number)
    const dialog = this.page.getByRole("dialog", { name: "Edit member" })
    await dialog.getByLabel("Last name").fill(lastname)
    await dialog.getByLabel("First name").fill(firstname)
    await dialog.getByRole("button", { name: "Save changes" }).click()
    await expect(this.page.getByRole("dialog", { name: "Edit member" })).toBeHidden()
    await this.expectMember(number, lastname, firstname)
  }

  async removeMember(number: string) {
    await this.openEdit(number)
    await this.page.getByRole("dialog", { name: "Edit member" }).getByRole("button", { name: "Remove" }).click()
    const alert = this.page.getByRole("alertdialog", { name: "Remove this member?" })
    await expect(alert).toBeVisible()
    await alert.getByRole("button", { name: "Remove" }).click()
    await expect(this.row(number)).toHaveCount(0)
  }
}
