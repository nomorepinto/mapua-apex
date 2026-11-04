import fs from "node:fs"
import path from "node:path"

import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test"

import { account, attendanceBase, authDir, evaluationBase, type Account } from "./env"

fs.mkdirSync(authDir, { recursive: true })

export function apexAuthPath(key: string): string {
  return path.join(authDir, `apex-${key}.json`)
}

export function arcusAuthPath(app: "attendance" | "evaluation", key: string): string {
  return path.join(authDir, `${app}-${key}.json`)
}

export async function signInApex(page: Page, credentials: Account) {
  await page.goto("/")
  await page.getByRole("button", { name: "Sign In", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Welcome back" })
  await dialog.getByPlaceholder("you@example.com").fill(credentials.email)
  await dialog.getByPlaceholder("Enter your password").fill(credentials.password)
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForFunction(() =>
    Object.keys(sessionStorage).some((key) => key.startsWith("oidc.user:")),
  )
  const mailbox = dialog.getByText("No mailbox exists for this address")
  if (await mailbox.isVisible().catch(() => false)) {
    throw new Error(`Sign-in rejected the mailbox for ${credentials.email}`)
  }
}

export async function saveApexSession(page: Page, key: string) {
  const session = await page.evaluate(() => {
    const entries: Record<string, string> = {}
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const storageKey = sessionStorage.key(index)
      if (storageKey) entries[storageKey] = sessionStorage.getItem(storageKey) ?? ""
    }
    return entries
  })
  fs.writeFileSync(apexAuthPath(key), JSON.stringify(session))
}

export async function signInAndSaveApex(browser: Browser, key: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signInApex(page, account(key))
  await saveApexSession(page, key)
  await context.close()
}

export async function openApex(browser: Browser, key: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const session = JSON.parse(fs.readFileSync(apexAuthPath(key), "utf8")) as Record<string, string>
  const context = await browser.newContext()
  await context.addInitScript((entries) => {
    for (const [storageKey, value] of Object.entries(entries as Record<string, string>)) {
      sessionStorage.setItem(storageKey, value)
    }
    localStorage.setItem("apex_last_active_at", Date.now().toString())
    localStorage.removeItem("apex_session_id")
  }, session)
  const page = await context.newPage()
  return { page, close: () => context.close() }
}

async function hostedLogin(page: Page, startUrl: string, credentials: Account) {
  await page.goto(`${startUrl}/api/auth/login`, { waitUntil: "domcontentloaded" })
  const email = page.locator("input[name='username'], input[name='email'], input[type='email']").first()
  const password = page.locator("input[name='password'], input[type='password']").first()
  const next = page.getByRole("button", { name: /^next$/i }).first()
  // Cognito's managed login asks for the email first and reveals the password on
  // a second step; the classic hosted UI keeps both fields on one page. The
  // managed-login SPA renders the email step asynchronously and can re-mount the
  // input after hydration, wiping a value filled too early — the form then shows
  // "Missing email address" and Next never reveals the password. It also renders
  // Next asynchronously, so a one-shot fill/check/click can skip or be undone.
  // Drive the whole first step from a poll: keep the email populated (re-fill
  // whenever the SPA clears it), and in the two-step flow click Next only once
  // the field holds the address, until the password step renders.
  await expect
    .poll(
      async () => {
        if (await email.isVisible().catch(() => false)) {
          const typed = await email.inputValue().catch(() => "")
          if (typed !== credentials.email) {
            await email.fill(credentials.email).catch(() => undefined)
          }
        }
        if (await password.isVisible().catch(() => false)) return "password"
        if ((await next.isVisible().catch(() => false)) && (await next.isEnabled().catch(() => false))) {
          await next.click().catch(() => undefined)
        }
        return "waiting"
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe("password")
  await password.fill(credentials.password)

  await page.locator("button[type='submit'], input[type='submit']").first().click()
  await page.waitForURL(`${startUrl}/**`, { timeout: 45_000 })
}

export async function signInArcus(browser: Browser, app: "attendance" | "evaluation", key: string) {
  const base = app === "attendance" ? attendanceBase : evaluationBase
  const context = await browser.newContext()
  const page = await context.newPage()
  await hostedLogin(page, base, account(key))
  await context.storageState({ path: arcusAuthPath(app, key) })
  await context.close()
}

export async function openArcus(
  browser: Browser,
  app: "attendance" | "evaluation",
  key: string,
): Promise<{ page: Page; context: BrowserContext; close: () => Promise<void> }> {
  const base = app === "attendance" ? attendanceBase : evaluationBase
  const context = await browser.newContext({ storageState: arcusAuthPath(app, key) })
  const page = await context.newPage()
  return { page, context, close: () => context.close() }
}
