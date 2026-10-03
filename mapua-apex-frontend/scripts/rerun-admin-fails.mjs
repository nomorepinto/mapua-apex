import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASE_URL = "http://localhost:5176"
const CSV = join(ROOT, "tests/admin-test-cases.csv")

const AUTHORITY =
  "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_8n74mhAnM"
const CLIENT_ID = "heefkupi7cqt26k6cgsgglujh"
const OIDC_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`

function b64url(json) {
  return Buffer.from(JSON.stringify(json)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}
function fakeJwt(profile) {
  const now = Math.floor(Date.now() / 1000)
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url({
    sub: profile.sub, name: profile.name, email: profile.email,
    "cognito:groups": profile.groups, iss: AUTHORITY, aud: CLIENT_ID,
    iat: now, exp: now + 3600, token_use: "id",
  })}.qa`
}
function oidcUser() {
  const profile = { sub: "admin-1", name: "OSA Admin", email: "osa@mapua.edu.ph", groups: ["admin"] }
  const token = fakeJwt(profile)
  return {
    id_token: token, access_token: token, token_type: "Bearer",
    scope: "openid profile email", expires_at: Math.floor(Date.now() / 1000) + 3600,
    profile: { ...profile, "cognito:groups": profile.groups },
  }
}

const announcements = [{
  sent_at: "2026-09-08T07:00:00.000Z",
  content: "All SAAF filings for October events are due 11 working days before the activity date.",
}]
const signatories = [
  { signatory_id: "sig-adviser-1", name: "Prof. Santos", role: "adviser" },
  { signatory_id: "sig-dean-1", name: "Dean Reyes", role: "dean", department: "SOIT" },
  { signatory_id: "sig-admin-1", name: "OSA Admin", role: "admin" },
  { signatory_id: "sig-cdm-1", name: "CDM Officer", role: "cdm" },
  { signatory_id: "sig-osaar-1", name: "OSAAR Desk", role: "osaar" },
]

async function mock(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes("cognito") || url.includes("/.well-known/") || url.includes("/logout")) {
      await route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
      return
    }
    if (!url.includes("/api/v1/")) { await route.continue(); return }
    const path = new URL(url).pathname.replace(/\/$/, "")
    const ok = (data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) })
    if (path === "/api/v1/admins/announcements" && method === "GET") return ok(announcements)
    if (path === "/api/v1/admins/announcements" && method === "POST") {
      const body = route.request().postDataJSON() || {}
      announcements.unshift({ sent_at: new Date().toISOString(), content: body.content })
      return ok(announcements[0])
    }
    if (path.startsWith("/api/v1/admins/announcements/") && method === "DELETE") {
      announcements.splice(0, announcements.length)
      return ok({ ok: true })
    }
    if (path === "/api/v1/admins/signatories") return ok(signatories)
    if (path === "/api/v1/admins/organizations") return ok([])
    if (path === "/api/v1/admins/submissions") return ok([])
    await ok([])
  })
}

async function asAdmin(page, path, h1) {
  await page.addInitScript(({ key, user }) => sessionStorage.setItem(key, JSON.stringify(user)), {
    key: OIDC_KEY, user: oidcUser(),
  })
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.locator("h1").filter({ hasText: h1 }).first().waitFor({ timeout: 20000 })
}

function csvEscape(v) {
  const t = v == null ? "" : String(v)
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" })
  const results = {}

  async function run(name, fn) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await mock(page)
    try {
      results[name] = { status: "PASS", actual: await fn(page) }
      console.log("PASS", name)
    } catch (e) {
      results[name] = { status: "FAIL", actual: e instanceof Error ? e.message.split("\n")[0] : String(e) }
      console.log("FAIL", name, results[name].actual)
    }
    await ctx.close()
  }

  await run("New Announcement — whitespace content", async (page) => {
    await asAdmin(page, "/admin/dashboard", "Admin Panel")
    await page.getByRole("button", { name: "New announcement" }).click()
    await page.locator("#announcement-content").fill("     ")
    await page.getByRole("button", { name: "Post announcement" }).click()
    const err = page.getByText("Content is required.")
    try {
      await err.waitFor({ timeout: 5000 })
      return "Whitespace-only content showed Content is required. and did not post."
    } catch {
      const posted = await page.getByText("Announcement posted").count()
      throw new Error(posted
        ? "Spaces-only content posted successfully; Content is required. did not appear."
        : "No Content is required. error and no success toast after posting spaces.")
    }
  })

  await run("Delete Announcement modal — keep", async (page) => {
    await asAdmin(page, "/admin/dashboard", "Admin Panel")
    await page.getByRole("button", { name: /All SAAF filings/ }).click()
    await page.getByRole("heading", { name: "Edit announcement" }).waitFor()
    await page.getByRole("button", { name: "Delete" }).click()
    await page.getByRole("heading", { name: "Delete this announcement?" }).waitFor()
    await page.getByRole("button", { name: "Keep" }).click()
    await page.getByRole("heading", { name: "Edit announcement" }).waitFor()
    await page.getByRole("button", { name: "Cancel" }).click()
    if (!(await page.getByText("All SAAF filings").count())) throw new Error("Notice was removed")
    return "Delete confirm opened; Keep left the notice in the table."
  })

  await run("Add signatory — dean shows department", async (page) => {
    await asAdmin(page, "/admin/signatories", "Signatories")
    const add = page.locator("form").first()
    await add.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "Dean" }).click()
    await page.getByText("Optional. Stored uppercase").waitFor({ timeout: 8000 })
    return "Choosing Dean revealed the optional Department field."
  })

  await run("Page heading and sections", async (page) => {
    await asAdmin(page, "/admin/about", "About APEX")
    const needed = [
      "System Description",
      "Unified Institutional Alignment",
      "Tech Stack",
      "Development Team",
      "Jedrick",
      "Luna",
    ]
    const missing = []
    for (const label of needed) {
      const n = await page.getByRole("heading", { name: label }).count()
        || await page.getByText(label, { exact: true }).count()
      if (!n) missing.push(label)
    }
    if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`)
    return "About APEX showed description, alignment, tech stack, Development Team, and member cards."
  })

  await browser.close()

  const lines = readFileSync(CSV, "utf8").split(/\r?\n/)
  const updated = lines.map((line) => {
    for (const [name, result] of Object.entries(results)) {
      if (!line.startsWith(`${csvEscape(name)},`)) continue
      const parts = parseCsvLine(line)
      if (parts[0] !== name) continue
      parts[6] = result.actual
      parts[7] = result.status
      return parts.map(csvEscape).join(",")
    }
    return line
  })
  writeFileSync(CSV, updated.filter((l, i, a) => l || i < a.length - 1).join("\n") + (updated.at(-1) === "" ? "" : "\n"))

  const pass = Object.values(results).filter((r) => r.status === "PASS").length
  const fail = Object.values(results).filter((r) => r.status === "FAIL").length
  console.log(`\nRerun ${pass} PASS, ${fail} FAIL`)
}

function parseCsvLine(line) {
  const out = []
  let cur = ""
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
      if (c === '"') { q = false; continue }
      cur += c
      continue
    }
    if (c === '"') { q = true; continue }
    if (c === ",") { out.push(cur); cur = ""; continue }
    cur += c
  }
  out.push(cur)
  return out
}

main().catch((e) => { console.error(e); process.exit(1) })
