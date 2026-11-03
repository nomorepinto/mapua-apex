import { expect, type Locator, type Page } from "@playwright/test"

import { rememberBody } from "./manifest"

export async function choose(page: Page, combobox: Locator, option: string | RegExp) {
  await combobox.click()
  const match = page.getByRole("listbox").last().getByRole("option", { name: option }).first()
  await expect(match).toBeVisible()
  await match.click({ timeout: 10_000 })
  if (typeof option === "string") {
    await expect(page.getByRole("listbox")).toHaveCount(0)
    await expect.poll(async () => {
      const value = await combobox.inputValue().catch(() => "")
      const text = (await combobox.textContent()) ?? ""
      return `${value} ${text}`
    }).toContain(option)
  }
}

export async function pickIsoDate(page: Page, trigger: Locator, iso: string) {
  await trigger.click()
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const monthName = date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
  const weekday = date.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" })
  const ordinal = `${day}${daySuffix(day)}`
  const cell = page
    .getByRole("gridcell", { name: new RegExp(`${weekday}, ${monthName} ${ordinal}, ${year}`) })
    .first()
  await expect(cell).toBeVisible()
  if ((await cell.getAttribute("aria-selected")) !== "true") await cell.click()
  await page.keyboard.press("Escape")
  await expect(cell).toBeHidden()
}

/** Wait for a mutation the click already triggers, and keep its ids for cleanup. */
export async function captureJson(page: Page, urlPart: string, method: string, action: () => Promise<void>) {
  const pending = page.waitForResponse(
    (response) =>
      response.url().includes(urlPart) &&
      response.request().method() === method &&
      response.ok(),
    { timeout: 30_000 },
  )
  try {
    await action()
  } catch (error) {
    pending.catch(() => undefined)
    throw error
  }
  const response = await pending
  const body = (await response.json()) as unknown
  await rememberBody(body, response.url())
  return body as Record<string, unknown>
}

export async function clickNamed(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true })
  await expect(button).toBeEnabled()
  await button.click()
}

export function stepPanel(page: Page): Locator {
  return page.locator("[data-saaf-step]:not([hidden])")
}

function daySuffix(day: number): string {
  const mod100 = day % 100
  if (mod100 >= 11 && mod100 <= 13) return "th"
  if (day % 10 === 1) return "st"
  if (day % 10 === 2) return "nd"
  if (day % 10 === 3) return "rd"
  return "th"
}
