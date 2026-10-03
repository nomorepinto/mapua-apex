import { mkdir, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const OUT_DIR = join(ROOT, "screenshots")
const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://localhost:5176"

const AUTHORITY =
  "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_8n74mhAnM"
const CLIENT_ID = "heefkupi7cqt26k6cgsgglujh"
const OIDC_KEY = `oidc.user:${AUTHORITY}:${CLIENT_ID}`
const WIZARD_KEY = "apex_org_wizard_v1"

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]

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

function oidcUser(role) {
  const profiles = {
    student: {
      sub: "student-1",
      name: "Jane Doe",
      email: "jane@mapua.edu.ph",
      groups: ["org_submitter"],
      organizationId: ORG_ID,
    },
    signatory: {
      sub: "signatory-1",
      name: "Prof. Santos",
      email: "adviser@mapua.edu.ph",
      groups: ["org_adviser"],
      signatoryId: "sig-adviser-1",
    },
    admin: {
      sub: "admin-1",
      name: "OSA Admin",
      email: "osa@mapua.edu.ph",
      groups: ["admin"],
    },
  }
  const profile = profiles[role]
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
      "custom:signatory_id": profile.signatoryId,
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

function makeSubmission({
  eventId,
  submissionId,
  title,
  status,
  currentSignatory = "adviser",
}) {
  return {
    event_id: eventId,
    submission_id: submissionId,
    submission_type: "saaf",
    sent_at: "2026-09-01T08:00:00.000Z",
    status,
    current_signatory: currentSignatory,
    activity_classification: {
      activity_type: "co-curricular",
      total_org_members: 48,
    },
    proponents: [PROPONENT],
    activity_details: {
      title_and_nature: title,
      description:
        "A week-long co-curricular program of workshops, talks, and showcases that help student organizations prepare official activity proposals and campus events.",
      objectives:
        "Skill building: Train officers on SAAF filing.\nCommunity: Increase cross-org collaboration.",
      venue: "Mapúa Intramuros Gym",
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
      core_values_explanation:
        "The activity develops discipline, excellence, and integrity through structured workshops.",
      peo_explanation:
        "Graduates practice professional communication and project leadership on campus.",
      sdg_explanation:
        "Supports Quality Education by giving students applied planning experience.",
    },
    detailed_budget_proposal: {
      items: [
        {
          item_no: "Printed kits",
          unit: 1,
          quantity: 50,
          price_per_unit: 80,
          total: 4000,
        },
      ],
      grand_total: 4000,
    },
    venue_reservation: { has_reservation: true },
  }
}

const SUBMISSIONS = [
  makeSubmission({
    eventId: EVENT_ID,
    submissionId: SUBMISSION_PENDING,
    title: "Tech Week 2026",
    status: "pending",
    currentSignatory: "dean",
  }),
  makeSubmission({
    eventId: "evt-retreat",
    submissionId: SUBMISSION_RETURNED,
    title: "Leadership Retreat",
    status: "returned",
    currentSignatory: "adviser",
  }),
  makeSubmission({
    eventId: "evt-outreach",
    submissionId: SUBMISSION_DENIED,
    title: "Outreach Drive",
    status: "denied",
    currentSignatory: "osaar",
  }),
]

const NOTIFICATIONS = {
  [SUBMISSION_PENDING]: [
    {
      submission_id: SUBMISSION_PENDING,
      sent_at: "2026-09-02T09:00:00.000Z",
      signatory: "adviser",
      notif_type: "approved",
      comment: "Looks complete. Endorsing to the dean.",
    },
  ],
  [SUBMISSION_RETURNED]: [
    {
      submission_id: SUBMISSION_RETURNED,
      sent_at: "2026-09-10T11:30:00.000Z",
      signatory: "adviser",
      notif_type: "returned",
      comment:
        "Please attach the updated budget breakdown and confirm the overnight venue with CDM before resubmitting.",
    },
  ],
  [SUBMISSION_DENIED]: [
    {
      submission_id: SUBMISSION_DENIED,
      sent_at: "2026-09-12T16:45:00.000Z",
      signatory: "osaar",
      notif_type: "denied",
      comment:
        "The proposed date conflicts with a university-wide examination week. Please file a new proposal for a later term.",
    },
  ],
}

const ORGANIZATION = {
  organization_id: ORG_ID,
  name: "Mapúa Google Club",
  signatories: [
    { role: "adviser", signatory_id: "sig-adviser-1" },
    { role: "dean", signatory_id: "sig-dean-1" },
    { role: "admin", signatory_id: "sig-admin-1" },
    { role: "cdm", signatory_id: "sig-cdm-1" },
  ],
}

const SIGNATORIES = [
  { signatory_id: "sig-adviser-1", name: "Prof. Santos", role: "adviser" },
  {
    signatory_id: "sig-dean-1",
    name: "Dean Reyes",
    role: "dean",
    department: "SOIT",
  },
  { signatory_id: "sig-admin-1", name: "OSA Admin", role: "admin" },
  { signatory_id: "sig-cdm-1", name: "CDM Officer", role: "cdm" },
  { signatory_id: "sig-osaar-1", name: "OSAAR Desk", role: "osaar" },
]

const ANNOUNCEMENTS = [
  {
    sent_at: "2026-09-08T07:00:00.000Z",
    content:
      "All SAAF filings for October events are due 11 working days before the activity date.",
  },
]

const DEADLINES = [
  {
    event_id: EVENT_ID,
    deadline_id: "dl-1",
    sent_at: "2026-09-01T08:00:00.000Z",
    deadline: daysFromNow(4),
  },
]

function json(data) {
  return { status: 200, contentType: "application/json", body: JSON.stringify({ data }) }
}

function matchApi(url, method = "GET") {
  const parsed = new URL(url)
  return `${method} ${parsed.pathname}${parsed.search}`
}

async function mockNetwork(page) {
  await page.route("**/*", async (route) => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    if (
      url.includes("amazoncognito.com") ||
      url.includes("cognito-idp.") ||
      url.includes("/.well-known/")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      })
      return
    }

    if (!url.includes("/api/v1/")) {
      await route.continue()
      return
    }

    const path = new URL(url).pathname.replace(/\/$/, "")
    const key = `${method} ${path}`

    const pending = SUBMISSIONS[0]
    const returned = SUBMISSIONS[1]
    const denied = SUBMISSIONS[2]

    const submissionByIds = {
      [`${EVENT_ID}/${SUBMISSION_PENDING}`]: pending,
      [`evt-retreat/${SUBMISSION_RETURNED}`]: returned,
      [`evt-outreach/${SUBMISSION_DENIED}`]: denied,
    }

    if (key === "GET /api/v1/students/organization") {
      await route.fulfill(json(ORGANIZATION))
      return
    }
    if (key === "GET /api/v1/students/submissions") {
      await route.fulfill(json(SUBMISSIONS))
      return
    }
    if (key === "GET /api/v1/students/announcements") {
      await route.fulfill(json(ANNOUNCEMENTS))
      return
    }
    if (key === "GET /api/v1/students/deadlines") {
      await route.fulfill(json(DEADLINES))
      return
    }
    if (key === "POST /api/v1/students/submissions") {
      await route.fulfill(json(pending))
      return
    }
    if (key === "GET /api/v1/signatories/me") {
      await route.fulfill(json(SIGNATORIES[0]))
      return
    }
    if (key === "GET /api/v1/signatories/submissions") {
      await route.fulfill(json(SUBMISSIONS))
      return
    }
    if (key === "GET /api/v1/admins/submissions") {
      await route.fulfill(json(SUBMISSIONS))
      return
    }
    if (key === "GET /api/v1/admins/announcements") {
      await route.fulfill(json(ANNOUNCEMENTS))
      return
    }
    if (key === "GET /api/v1/admins/organizations") {
      await route.fulfill(json([ORGANIZATION]))
      return
    }
    if (key === "GET /api/v1/admins/signatories") {
      await route.fulfill(json(SIGNATORIES))
      return
    }

    const studentDetail = path.match(
      /\/api\/v1\/students\/events\/([^/]+)\/submissions\/([^/]+)$/,
    )
    if (studentDetail && method === "GET") {
      const item = submissionByIds[`${studentDetail[1]}/${studentDetail[2]}`]
      await route.fulfill(json(item || pending))
      return
    }

    const notifMatch = path.match(
      /\/api\/v1\/(?:students|admins|signatories)\/events\/([^/]+)\/submissions\/([^/]+)\/notifications$/,
    )
    if (notifMatch && method === "GET") {
      await route.fulfill(json(NOTIFICATIONS[notifMatch[2]] || []))
      return
    }

    const signatoryDetail = path.match(
      /\/api\/v1\/signatories\/events\/([^/]+)\/submissions\/([^/]+)$/,
    )
    if (signatoryDetail && method === "GET") {
      const item = submissionByIds[`${signatoryDetail[1]}/${signatoryDetail[2]}`]
      await route.fulfill(json(item || pending))
      return
    }

    const adminDetail = path.match(
      /\/api\/v1\/admins\/events\/([^/]+)\/submissions\/([^/]+)$/,
    )
    if (adminDetail && method === "GET") {
      const item = submissionByIds[`${adminDetail[1]}/${adminDetail[2]}`]
      await route.fulfill(
        json({
          ...(item || pending),
          notifications: NOTIFICATIONS[adminDetail[2]] || [],
        }),
      )
      return
    }

    if (method === "POST" || method === "PUT" || method === "DELETE") {
      await route.fulfill(json({ ok: true }))
      return
    }

    console.warn("Unmocked API", matchApi(url, method))
    await route.fulfill(json([]))
  })
}

function saafDraft(eventName) {
  const eventDate = daysFromNow(21)
  const endDate = daysFromNow(23)
  return {
    activityType: "co-curricular",
    totalOrgMembers: "48",
    expectedParticipants: "120",
    individualContribution: "150",
    proposedBudget: "25000",
    dayOfEvent: "Monday",
    departmentValues: {
      "1": "School of Information Technology (SOIT)",
    },
    activityTitle: eventName,
    activityDescription:
      "A week-long co-curricular program of workshops, talks, and showcases that help student organizations prepare official activity proposals and campus events for Mapúa University.",
    activityObjectives:
      "Train officers on SAAF filing and raise cross-organization collaboration during the academic term.",
    activityVenue: "Mapúa Intramuros Gym",
    dateOfEvent: eventDate,
    endDateOfEvent: endDate,
    timeOfEvent: "09:00 - 17:00",
    timeOfEventStart: "09:00",
    timeOfEventEnd: "17:00",
    mission1: true,
    mission2: false,
    mission3: true,
    coreValuesExplanation:
      "The activity develops discipline, excellence, and integrity through structured workshops.",
    peoExplanation:
      "Graduates practice professional communication and project leadership on campus.",
    sdgExplanation:
      "Supports Quality Education by giving students applied planning experience.",
    proponents: [
      {
        id: "1",
        position: "Project Lead",
        firstName: "Jane",
        middleName: "A",
        lastName: "Doe",
        suffix: "",
        studentNumber: "2023101234",
        programAndYear: "BSCS - 3rd Year",
        dateOfSubmission: daysFromNow(0),
        department: "School of Information Technology (SOIT)",
        positionOfApplicant: "President",
        orgOrCourseSection: "Mapúa Google Club",
        contactNumber: "09171234567",
        emailAddress: "jane@mymail.mapua.edu.ph",
        facebookLink: "https://facebook.com/janedoe",
      },
    ],
    budgetItems: [
      { id: "1", item: "Printed kits", unit: "1", quantity: "50", pricePerUnit: "80" },
    ],
  }
}

function reservationDraft() {
  const date = daysFromNow(21)
  return {
    equipment: {
      monoblock: true,
      whiteboards: true,
      tables: true,
      rostrum: false,
      flags: false,
      panelBoards: false,
      others: false,
    },
    otherEquipmentText: "",
    purpose: "Tech Week opening exhibit",
    functionRoomPurpose: "Keynote and workshops",
    avPurpose: "Stage presentation support",
    facilityItems: [
      {
        id: "1",
        item: "North Circle booths",
        dateOfUse: date,
        endDateOfUse: date,
        timeOfUse: "08:00",
        endTimeOfUse: "18:00",
        location: "North Circle",
      },
    ],
    roomItems: [
      {
        id: "1",
        dateNeeded: date,
        endDateNeeded: date,
        timeNeeded: "09:00",
        endTimeNeeded: "12:00",
        roomNeeded: "AV Room",
        remarks: "Keynote",
      },
      {
        id: "2",
        dateNeeded: date,
        endDateNeeded: date,
        timeNeeded: "13:00",
        endTimeNeeded: "17:00",
        roomNeeded: "Seminar Room",
        remarks: "Breakout",
      },
    ],
    avItems: [
      {
        id: "1",
        dateNeeded: date,
        endDateNeeded: date,
        timeNeeded: "08:00",
        endTimeNeeded: "18:00",
        equipmentNeeded: "LCD",
        remarks: "",
      },
    ],
  }
}

function wizardState({ reserveFacilities, saafValidated = false }) {
  return {
    eventName: "Tech Week 2026",
    reserveFacilities,
    saafValidated,
    saafDraft: saafDraft("Tech Week 2026"),
    reservationDraft: reservationDraft(),
    editingEventId: null,
    editingSubmissionId: null,
  }
}

async function settle(page, ms = 450) {
  await page.waitForTimeout(ms)
}

async function waitForApp(page, text) {
  await page.getByText("Authenticating...").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {})
  await page.getByText("Access Denied").waitFor({ state: "hidden", timeout: 1000 }).catch(() => {})
  if (text) {
    await page.getByRole("heading", { name: text }).first().waitFor({
      state: "visible",
      timeout: 20000,
    })
  }
  await settle(page)
}

async function shot(page, viewport, name, { fullPage = true } = {}) {
  const file = join(OUT_DIR, viewport, `${name}.png`)
  await page.screenshot({ path: file, fullPage, animations: "disabled" })
  console.log(`  ${viewport}/${name}.png`)
}

async function closeOverlayDialog(page) {
  const close = page.getByRole("button", { name: "Close" })
  if (await close.count()) {
    await close.last().click()
  } else {
    await page.keyboard.press("Escape")
  }
  await page.locator('[data-slot="dialog-popup"]').last().waitFor({ state: "hidden", timeout: 4000 }).catch(() => {})
  await settle(page, 250)
}

async function dismissDialogs(page) {
  for (let i = 0; i < 4; i += 1) {
    const popup = page.locator('[data-slot="dialog-popup"]').last()
    const visible = await popup.isVisible().catch(() => false)
    if (!visible) break
    await page.keyboard.press("Escape")
    await settle(page, 200)
  }
}

async function installSessionHooks(page) {
  await page.addInitScript(
    ({ oidcKey, user, wizardKey, wizard }) => {
      if (!sessionStorage.getItem(oidcKey)) {
        sessionStorage.setItem(oidcKey, JSON.stringify(user))
      }
      if (!sessionStorage.getItem(wizardKey)) {
        sessionStorage.setItem(
          wizardKey,
          JSON.stringify({ state: wizard, version: 0 }),
        )
      }
      const style = document.createElement("style")
      style.textContent =
        "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }"
      document.documentElement.appendChild(style)
    },
    {
      oidcKey: OIDC_KEY,
      user: oidcUser("student"),
      wizardKey: WIZARD_KEY,
      wizard: wizardState({ reserveFacilities: "yes", saafValidated: true }),
    },
  )
}

async function setSession(page, { role, wizard } = {}) {
  await page.evaluate(
    ({ oidcKey, user, wizardKey, wizard }) => {
      if (user) sessionStorage.setItem(oidcKey, JSON.stringify(user))
      if (wizard) {
        sessionStorage.setItem(
          wizardKey,
          JSON.stringify({ state: wizard, version: 0 }),
        )
      }
    },
    {
      oidcKey: OIDC_KEY,
      user: role ? oidcUser(role) : null,
      wizardKey: WIZARD_KEY,
      wizard: wizard ?? null,
    },
  )
}

async function gotoRole(page, role, path, readyText, wizard) {
  const onApp = page.url().startsWith(BASE_URL)
  if (onApp) {
    await setSession(page, { role, wizard })
  }
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 30000 })
  if (!onApp && (role !== "student" || wizard)) {
    await setSession(page, { role, wizard })
    await page.reload({ waitUntil: "domcontentloaded" })
  }
  await waitForApp(page, readyText)
}

async function setWizard(page, state) {
  await setSession(page, { wizard: state })
}

async function captureStudent(page, viewport) {
  await gotoRole(page, "student", "/students/dashboard", "Mapúa Google Club Dashboard")
  await shot(page, viewport, "students-dashboard")

  await page.getByText("Tech Week 2026").first().click()
  await page.getByText("Document Specification & Details").waitFor({ timeout: 10000 })
  await settle(page)
  await shot(page, viewport, "students-dashboard--submission-tracker-details", { fullPage: false })

  const progressTab = page.getByRole("button", { name: /Progress|Milestone/ })
  await progressTab.click()
  await settle(page)
  await shot(page, viewport, "students-dashboard--submission-tracker-progress", { fullPage: false })
  await page.getByRole("button", { name: "Close submission tracker" }).click()
  await settle(page)

  await page.locator("button").filter({ hasText: "OUTREACH DRIVE" }).click()
  await page.getByRole("dialog").waitFor({ timeout: 8000 })
  await settle(page)
  await shot(page, viewport, "students-dashboard--review-notice-denied", { fullPage: false })
  await closeOverlayDialog(page)

  await page.locator("button").filter({ hasText: "LEADERSHIP RETREAT" }).click()
  await page.getByRole("dialog").waitFor({ timeout: 8000 })
  await settle(page)
  await shot(page, viewport, "students-dashboard--review-notice-returned", { fullPage: false })
  await closeOverlayDialog(page)

  if (viewport !== "desktop") {
    await page.getByRole("button", { name: "Open navigation" }).click()
    await page.getByRole("button", { name: "Close navigation" }).waitFor()
    await settle(page)
    await shot(page, viewport, "students-dashboard--mobile-nav", { fullPage: false })
    await page.getByRole("button", { name: "Sign Out" }).click()
  } else {
    await page.getByRole("button", { name: "Sign Out" }).click()
  }
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "students-dashboard--sign-out", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).click()
  await settle(page)

  await page.goto(`${BASE_URL}/students/submissions`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "Create your Activity Proposal")
  await shot(page, viewport, "students-submissions")

  await page.getByRole("button", { name: "Guide" }).click()
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "students-submissions--guide", { fullPage: false })
  await closeOverlayDialog(page)

  await setWizard(page, wizardState({ reserveFacilities: "no", saafValidated: false }))
  await page.goto(`${BASE_URL}/students/submissions/saaf`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "Student Activity Application Form")
  await shot(page, viewport, "students-saaf-step-1-classification")

  await page.getByRole("button", { name: "Continue" }).click()
  await settle(page, 600)
  await shot(page, viewport, "students-saaf-step-2-proponents")

  await page.getByRole("button", { name: "Continue" }).click()
  await settle(page, 600)
  await shot(page, viewport, "students-saaf-step-3-details")

  await page.getByRole("button", { name: "Continue" }).click()
  await settle(page, 600)
  await shot(page, viewport, "students-saaf-step-4-alignment")

  await page.getByRole("button", { name: "Clear" }).click()
  await page.getByText("Are you sure you want to clear?").waitFor()
  await settle(page)
  await shot(page, viewport, "students-saaf--confirm-clear", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).click()
  await settle(page)

  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "students-saaf--confirm-submit", { fullPage: false })
  await page.getByRole("button", { name: "Proceed" }).click()
  await page.getByText("Activity Application Submitted!").waitFor({ timeout: 15000 })
  await settle(page)
  await shot(page, viewport, "students-saaf--success", { fullPage: false })

  await setWizard(page, wizardState({ reserveFacilities: "yes", saafValidated: true }))
  await page.goto(`${BASE_URL}/students/submissions/saaf/reservations`, {
    waitUntil: "domcontentloaded",
  })
  await waitForApp(page, "Reservation of Facilities")
  await shot(page, viewport, "students-reservations")

  await page.getByRole("button", { name: "Clear" }).click()
  await page.getByText("Are you sure you want to clear?").waitFor()
  await settle(page)
  await shot(page, viewport, "students-reservations--confirm-clear", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).click()
  await settle(page)

  await page.getByRole("button", { name: "Submit" }).click()
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "students-reservations--confirm-submit", { fullPage: false })
  await page.getByRole("button", { name: "Proceed" }).click()
  const reservationSuccess = page.getByText("Facility Reservation Submitted!")
  try {
    await reservationSuccess.waitFor({ timeout: 8000 })
    await settle(page)
    await shot(page, viewport, "students-reservations--success", { fullPage: false })
  } catch {
    console.warn(
      "  reservation success modal did not stay open (page redirects after submit)",
    )
  }

  await page.goto(`${BASE_URL}/students/about`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "About APEX")
  await shot(page, viewport, "students-about")
}

async function captureSignatory(page, viewport) {
  await gotoRole(page, "signatory", "/signatories/dashboard", "Review Dashboard")
  await shot(page, viewport, "signatories-dashboard")

  await page.locator("#activity-filter-btn").click()
  await page.getByRole("dialog", { name: "Filter by Department and Organization" }).waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--filter", { fullPage: false })
  await page.keyboard.press("Escape")
  await settle(page)

  await page.getByRole("button", { name: /View details for Tech Week 2026/ }).click()
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--activity-detail", { fullPage: false })

  await page.getByRole("button", { name: "Approve Proposal" }).click()
  await page.getByText("Endorse Tech Week 2026?").waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--approve-confirm", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).last().click()
  await settle(page, 400)

  await page.getByRole("button", { name: "Return Proposal" }).click()
  await page.getByText("Return Proposal for Revision").waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--return-proposal", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).last().click()
  await settle(page, 400)

  await page.getByRole("button", { name: "Reject Proposal" }).click()
  await page.getByRole("heading", { name: "Reject Proposal" }).waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--reject-proposal", { fullPage: false })
  await dismissDialogs(page)

  if (viewport !== "desktop") {
    await page.getByRole("button", { name: "Open navigation" }).click()
    await settle(page)
    await shot(page, viewport, "signatories-dashboard--mobile-nav", { fullPage: false })
    await page.getByRole("button", { name: "Sign Out" }).click()
  } else {
    await page.getByRole("button", { name: "Sign Out" }).click()
  }
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "signatories-dashboard--sign-out", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).click()
  await settle(page)

  await page.goto(`${BASE_URL}/signatories/about`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "About APEX")
  await shot(page, viewport, "signatories-about")
}

async function captureAdmin(page, viewport) {
  await gotoRole(page, "admin", "/admin/dashboard", "Admin Panel")
  await shot(page, viewport, "admin-dashboard")

  await page.getByText("Tech Week 2026").first().click()
  await page.getByRole("dialog").waitFor()
  await settle(page, 700)
  await shot(page, viewport, "admin-dashboard--submission-detail", { fullPage: false })
  await closeOverlayDialog(page)

  await page.getByRole("button", { name: "New announcement" }).click()
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "admin-dashboard--new-announcement", { fullPage: false })
  await closeOverlayDialog(page)

  await page.getByText("All SAAF filings").first().click()
  await page.getByRole("heading", { name: "Edit announcement" }).waitFor()
  await settle(page)
  await shot(page, viewport, "admin-dashboard--edit-announcement", { fullPage: false })

  await page.getByRole("button", { name: "Delete" }).click()
  await page.getByRole("heading", { name: "Delete this announcement?" }).waitFor()
  await settle(page)
  await shot(page, viewport, "admin-dashboard--delete-announcement", { fullPage: false })
  await page.getByRole("button", { name: "Keep" }).click()
  await settle(page)
  await dismissDialogs(page)

  await page.goto(`${BASE_URL}/admin/organizations`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "Organizations")
  await shot(page, viewport, "admin-organizations")

  await page.getByRole("button", { name: "Edit" }).first().click()
  await page.getByRole("heading", { name: "Edit organization" }).waitFor()
  await settle(page)
  await shot(page, viewport, "admin-organizations--edit", { fullPage: false })
  await closeOverlayDialog(page)

  await page.goto(`${BASE_URL}/admin/signatories`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "Signatories")
  await shot(page, viewport, "admin-signatories")

  await page.getByRole("button", { name: "Edit" }).first().click()
  await page.getByRole("heading", { name: "Edit signatory" }).waitFor()
  await settle(page)
  await shot(page, viewport, "admin-signatories--edit", { fullPage: false })
  await closeOverlayDialog(page)

  if (viewport !== "desktop") {
    await page.getByRole("button", { name: "Open navigation" }).click()
    await settle(page)
    await shot(page, viewport, "admin-dashboard--mobile-nav", { fullPage: false })
    await page.getByRole("button", { name: "Sign Out" }).click()
  } else {
    await page.getByRole("button", { name: "Sign Out" }).click()
  }
  await page.getByRole("dialog").waitFor()
  await settle(page)
  await shot(page, viewport, "admin-dashboard--sign-out", { fullPage: false })
  await page.getByRole("button", { name: "Cancel" }).click()
  await settle(page)

  await page.goto(`${BASE_URL}/admin/about`, { waitUntil: "domcontentloaded" })
  await waitForApp(page, "About APEX")
  await shot(page, viewport, "admin-about")
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true })
  for (const viewport of VIEWPORTS) {
    await mkdir(join(OUT_DIR, viewport.name), { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })

  try {
    for (const viewport of VIEWPORTS) {
      console.log(`\nCapturing ${viewport.name} (${viewport.width}x${viewport.height})`)
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      })
      const page = await context.newPage()
      page.setDefaultTimeout(20000)
      await mockNetwork(page)
      await installSessionHooks(page)

      try {
        await captureStudent(page, viewport.name)
        await captureSignatory(page, viewport.name)
        await captureAdmin(page, viewport.name)
      } catch (error) {
        const failPath = join(OUT_DIR, viewport.name, "_failure.png")
        await page.screenshot({ path: failPath, fullPage: true }).catch(() => {})
        console.error(`Failed on ${viewport.name}:`, error)
        throw error
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nScreenshots saved to ${OUT_DIR}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
