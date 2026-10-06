// Temporary debug harness: renders /students/dashboard at mobile width with
// mocked network + injected session, measures overflow, writes a screenshot
// to scripts/debug-shot.png (does NOT touch screenshots/).
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://localhost:5176"

const AUTHORITY =
  "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_8n74mhAnM"
const CLIENT_ID = "heefkupi7cqt26k6cgsgglujh"
const OIDC_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`
const WIZARD_KEY = "apex_org_wizard_v1"

const EVENT_ID = "evt-tech-week"
const SUBMISSION_PENDING = "sub-pending-001"
const SUBMISSION_RETURNED = "sub-returned-002"
const SUBMISSION_DENIED = "sub-denied-003"
const ORG_ID = "org-mgc-001"

function daysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function b64url(json) {
  return Buffer.from(JSON.stringify(json))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function fakeJwt(profile) {
  const header = b64url({ alg: "none", typ: "JWT" })
  const now = Math.floor(Date.now() / 1000)
  const payload = b64url({
    sub: profile.sub,
    name: profile.name,
    email: profile.email,
    "cognito:groups": profile.groups,
    "custom:organization_id": profile.organizationId,
    "custom:signatory_id": profile.signatoryId,
    iss: AUTHORITY,
    aud: CLIENT_ID,
    iat: now,
    exp: now + 60 * 60 * 12,
    token_use: "id",
  })
  return `${header}.${payload}.screenshot`
}

function oidcUser() {
  const profile = {
    sub: "student-1",
    name: "Jane Doe",
    email: "jane@mapua.edu.ph",
    groups: ["org_submitter"],
    organizationId: ORG_ID,
  }
  const token = fakeJwt(profile)
  const now = Math.floor(Date.now() / 1000)
  return {
    id_token: token,
    access_token: token,
    token_type: "Bearer",
    scope: "openid profile email",
    expires_at: now + 60 * 60 * 12,
    profile: {
      sub: profile.sub,
      name: profile.name,
      email: profile.email,
      "cognito:groups": profile.groups,
      "custom:organization_id": profile.organizationId,
    },
  }
}

const PROPONENT = {
  id: "1",
  position_title: "Project Lead",
  first_name: "Jane",
  middle_name: "A",
  last_name: "Doe",
  suffix: "",
  student_number: "2023101234",
  program_and_year: "BSCS - 3rd Year",
  date_of_submission: daysFromNow(0),
  department: "School of Information Technology (SOIT)",
  position_of_applicant: "President",
  org_or_course_section: "Mapúa Google Club",
  contact_number: "09171234567",
  email_address: "jane@mymail.mapua.edu.ph",
  facebook_link: "https://facebook.com/janedoe",
}

function makeSubmission({ eventId, submissionId, title, status, currentSignatory = "adviser" }) {
  return {
    event_id: eventId,
    submission_id: submissionId,
    submission_type: "saaf",
    sent_at: "2026-09-01T08:00:00.000Z",
    status,
    current_signatory: currentSignatory,
    activity_classification: { activity_type: "co-curricular", total_org_members: 48 },
    proponents: [PROPONENT],
    activity_details: {
      title_and_nature: title,
      description: "A week-long co-curricular program of workshops, talks, and showcases.",
      objectives: "Skill building: Train officers on SAAF filing.",
      venue: "Intramuros Campus",
      date_of_event: daysFromNow(21),
      end_date_of_event: daysFromNow(23),
      day_of_event: "Monday",
      time_of_event: "09:00 - 17:00",
      expected_participants: 120,
      individual_contribution: 150,
      proposed_budget: 25000,
    },
    institutional_alignment: {
      mission_statements: { competitive: true, research: false, solutions: true },
      core_values_explanation: "Discipline, excellence, integrity.",
      peo_explanation: "Professional communication and project leadership.",
      sdg_explanation: "Quality Education.",
    },
    detailed_budget_proposal: {
      items: [{ item_no: "Printed kits", unit: 1, quantity: 50, price_per_unit: 80, total: 4000 }],
      grand_total: 4000,
    },
    venue_reservation: { has_reservation: true },
  }
}

const SUBMISSIONS = [
  makeSubmission({ eventId: EVENT_ID, submissionId: SUBMISSION_PENDING, title: "Tech Week 2026", status: "pending", currentSignatory: "dean" }),
  makeSubmission({ eventId: "evt-retreat", submissionId: SUBMISSION_RETURNED, title: "Leadership Retreat", status: "returned", currentSignatory: "adviser" }),
  makeSubmission({ eventId: "evt-outreach", submissionId: SUBMISSION_DENIED, title: "Outreach Drive", status: "denied", currentSignatory: "osaar" }),
]

const ORGANIZATION = {
  organization_id: ORG_ID,
  name: "Mapúa Google Club",
  signatories: [
    { role: "adviser", signatory_id: "sig-adviser-1" },
    { role: "dean", signatory_id: "sig-dean-1" },
  ],
}

const ANNOUNCEMENTS = [
  { sent_at: "2026-09-08T07:00:00.000Z", content: "All SAAF filings for October events are due 11 working days before the activity date." },
]

const DEADLINES = [
  { event_id: EVENT_ID, deadline_id: "dl-1", sent_at: "2026-09-01T08:00:00.000Z", deadline: daysFromNow(4) },
]

function json(data) {
  return { status: 200, contentType: "application/json", body: JSON.stringify({ data }) }
}

async function mockNetwork(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (
      url.includes("amazoncognito.com") ||
      url.includes("cognito-idp.") ||
      url.includes("/.well-known/")
    ) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
      return
    }
    if (!url.includes("/api/v1/")) {
      await route.continue()
      return
    }
    const path = new URL(url).pathname.replace(/\/$/, "")
    const key = `${method} ${path}`

    if (key === "GET /api/v1/students/organization") return void (await route.fulfill(json(ORGANIZATION)))
    if (key === "GET /api/v1/students/submissions") return void (await route.fulfill(json(SUBMISSIONS)))
    if (key === "GET /api/v1/students/announcements") return void (await route.fulfill(json(ANNOUNCEMENTS)))
    if (key === "GET /api/v1/students/deadlines") return void (await route.fulfill(json(DEADLINES)))
    await route.fulfill(json([]))
  })
}

async function main() {
  const [widthArg, heightArg, tagArg] = process.argv.slice(2)
  const width = Number(widthArg || 390)
  const height = Number(heightArg || 844)
  const tag = tagArg || "mobile"
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  await mockNetwork(page)
  await page.addInitScript(
    ({ oidcKey, user, wizardKey, wizard }) => {
      sessionStorage.setItem(oidcKey, JSON.stringify(user))
      sessionStorage.setItem(wizardKey, JSON.stringify({ state: wizard, version: 0 }))
    },
    {
      oidcKey: OIDC_KEY,
      user: oidcUser(),
      wizardKey: WIZARD_KEY,
      wizard: { eventName: "Tech Week 2026", reserveFacilities: "yes", saafValidated: true, saafDraft: {}, reservationDraft: {}, editingEventId: null, editingSubmissionId: null },
    },
  )

  await page.goto(`${BASE_URL}/students/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.getByRole("heading", { name: "Mapúa Google Club Dashboard" }).first().waitFor({ state: "visible", timeout: 20000 })
  await page.waitForTimeout(600)

  const report = await page.evaluate(() => {
    const widths = (el) =>
      el ? { client: el.clientWidth, scroll: el.scrollWidth, offset: el.offsetWidth } : null
    const doc = document.documentElement
    const body = document.body
    const sectionFlush = document.querySelector(".overflow-hidden.rounded-2xl, [class*='rounded-2xl']")
    const tableWrap = [...document.querySelectorAll("div")].find((d) => d.className.includes("overflow-x-auto"))
    const innerTable = tableWrap?.querySelector("[data-slot='table-container']")
    const table = innerTable?.querySelector("table") ?? tableWrap?.querySelector("table")
    // Any element wider than viewport?
    const overflowers = []
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect()
      if (r.width > window.innerWidth + 1 || r.right > window.innerWidth + 1) {
        overflowers.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") || "").slice(0, 110),
          width: Math.round(r.width),
          right: Math.round(r.right),
        })
      }
    }
    return {
      viewport: window.innerWidth,
      html: { client: doc.clientWidth, scroll: doc.scrollWidth },
      body: widths(body),
      firstTableWrap: widths(tableWrap),
      tableContainer: widths(innerTable),
      table: table ? { offset: table.offsetWidth, scroll: table.scrollWidth } : null,
      overflowCount: overflowers.length,
      overflowers: overflowers.slice(0, 25),
    }
  })
  console.log(JSON.stringify(report, null, 2))

  const header = await page.evaluate(() => {
    const h1 = document.querySelector("h1")
    const r = h1.getBoundingClientRect()
    const cs = getComputedStyle(h1)
    const range = document.createRange()
    range.selectNodeContents(h1)
    const textRect = range.getBoundingClientRect()
    return {
      text: h1.textContent,
      left: r.left,
      right: r.right,
      width: r.width,
      textRight: textRect.right,
      scrollWidth: h1.scrollWidth,
      clientWidth: h1.clientWidth,
      fontSize: cs.fontSize,
      viewport: window.innerWidth,
      clipped: textRect.right > window.innerWidth,
    }
  })
  console.log(JSON.stringify(header, null, 2))

  await page.screenshot({ path: join(ROOT, "scripts", `debug-shot-${tag}.png`), fullPage: true })
  await page.locator("h1").first().screenshot({ path: join(ROOT, "scripts", "debug-h1.png") }).catch(() => {})

  // Close-up of the submissions panel (table area).
  await page.getByRole("heading", { name: "Project Status & Submissions" }).locator("xpath=ancestor::div[2]").screenshot({ path: join(ROOT, "scripts", "debug-panel-top.png") }).catch((e) => console.warn("panel top", e.message))

  // Scroll the table container to the far right and capture again.
  await page.evaluate(() => {
    const wraps = [...document.querySelectorAll("div")].filter((d) => d.className.includes("overflow-x-auto"))
    const wrap = wraps.find((d) => d.scrollWidth > d.clientWidth + 50)
    if (wrap) wrap.scrollLeft = wrap.scrollWidth
  })
  await page.waitForTimeout(300)
  await page.getByRole("heading", { name: "Project Status & Submissions" }).locator("xpath=ancestor::div[2]").screenshot({ path: join(ROOT, "scripts", "debug-panel-scrolled.png") }).catch(() => {})

  // Bottom of the page (reminders).
  await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.scrollingElement
    if (main) main.scrollTop = main.scrollHeight
    window.scrollTo(0, document.body.scrollHeight)
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(ROOT, "scripts", "debug-bottom.png"), fullPage: false })

  // Mobile nav sheet.
  await page.getByRole("button", { name: "Open navigation" }).click().catch((e) => console.warn("nav", e.message))
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(ROOT, "scripts", "debug-nav.png"), fullPage: false })

  console.log("wrote debug screenshots")

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
