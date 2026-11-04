import { expect, type Locator, type Page } from "@playwright/test"

/**
 * Announcements desk at `/osaar/dashboard/announcements`. Announcements have no
 * run id token, so the spec posts, edits, then deletes one — the DELETE leaves
 * no orphan behind. `marker` is a short substring unique to the run, used to
 * find the row; `content` is the full, human-readable notice.
 */
export class AnnouncementsPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/osaar/dashboard/announcements")
    await expect(this.page.getByRole("heading", { name: "Announcements" })).toBeVisible()
  }

  private row(marker: string): Locator {
    // The data row is a clickable <tr role="button"> whose accessible name is
    // the posted date plus the notice text, so it is matched as a button, not a
    // row (the header <tr> keeps role="row" and never carries the marker).
    return this.page.getByRole("button", { name: marker })
  }

  private async fillContent(label: string, value: string) {
    const field = this.page.getByRole("dialog").getByLabel(label)
    await field.fill(value)
    await field.blur()
  }

  async create(marker: string, content: string) {
    await this.page.getByRole("button", { name: "New announcement" }).click()
    const dialog = this.page.getByRole("dialog", { name: "New announcement" })
    await this.fillContent("Content", content)
    const post = dialog.getByRole("button", { name: "Post announcement" })
    await expect(post).toBeEnabled({ timeout: 15_000 })
    await post.click()
    await expect(dialog).toBeHidden()
    await expect(this.row(marker).first()).toBeVisible()
  }

  private async openRow(marker: string) {
    await this.row(marker).first().click()
    await expect(this.page.getByRole("dialog", { name: "Edit announcement" })).toBeVisible()
  }

  async edit(marker: string, content: string) {
    await this.openRow(marker)
    const dialog = this.page.getByRole("dialog", { name: "Edit announcement" })
    await this.fillContent("Content", content)
    const save = dialog.getByRole("button", { name: "Save changes" })
    await expect(save).toBeEnabled({ timeout: 15_000 })
    await save.click()
    await expect(dialog).toBeHidden()
    await expect(this.page.getByText(content).first()).toBeVisible()
  }

  async remove(marker: string) {
    await this.openRow(marker)
    await this.page.getByRole("dialog", { name: "Edit announcement" }).getByRole("button", { name: "Delete" }).click()
    const alert = this.page.getByRole("alertdialog", { name: "Delete this announcement?" })
    await expect(alert).toBeVisible()
    await alert.getByRole("button", { name: "Delete" }).click()
    await expect(this.row(marker)).toHaveCount(0)
  }
}
