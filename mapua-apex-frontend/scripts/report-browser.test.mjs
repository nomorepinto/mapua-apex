import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Invoked by the Nest fixture; never targets a deployed API or real account.
const base = process.env.REPORT_BROWSER_URL
assert(base && new URL(base).hostname === '127.0.0.1', 'A loopback Nest/Vite fixture is required')
const artifacts = fileURLToPath(new URL('../../.qoder/report-tests/', import.meta.url))
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.REPORT_BROWSER_CHANNEL })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort())
await context.addInitScript(() => {
  if (sessionStorage.getItem('oidc.user:http://127.0.0.1:1:report-test')) return
  sessionStorage.setItem('oidc.user:http://127.0.0.1:1:report-test', JSON.stringify({
    id_token: 'admin', access_token: 'admin', token_type: 'Bearer', scope: 'openid profile email',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    profile: { sub: 'admin-sub', name: 'Admin Example', email: 'admin@mapua.edu.ph', 'cognito:groups': ['admin'] },
  }))
})
const page = await context.newPage()
page.setDefaultTimeout(60_000)
page.setDefaultNavigationTimeout(60_000)
const errors = []
const listRequests = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {
  if (request.url().includes('/admins/monitor/sessions?')) listRequests.push(request.url())
  assert(!request.url().includes('/api/v1/'), 'Browser must use Nest /api/v2')
})
async function visible(locator) { await locator.waitFor({ state: 'visible' }) }
async function text(locator, expected) {
  await page.waitForFunction(({ selector, expected }) => [...document.querySelectorAll(selector)].some((element) => element.textContent.includes(expected)), { selector: await locator.evaluate((element) => { element.setAttribute('data-report-assert', 'current'); return '[data-report-assert="current"]' }), expected })
  assert((await locator.innerText()).includes(expected))
  await locator.evaluate((element) => element.removeAttribute('data-report-assert'))
}
async function select(root, label, option) {
  await root.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
async function download(root, button, extension) {
  const pending = page.waitForEvent('download')
  await root.getByRole('button', { name: button, exact: true }).click()
  const file = await pending
  assert(file.suggestedFilename().endsWith(extension))
  assert.equal(await file.failure(), null)
  const path = `${artifacts}/${file.suggestedFilename()}`
  await file.saveAs(path)
  return readFile(path)
}
async function signIn(token, group, claims, path) {
  await page.evaluate(({ token, group, claims }) => {
    sessionStorage.setItem('oidc.user:http://127.0.0.1:1:report-test', JSON.stringify({ id_token: token, access_token: token, token_type: 'Bearer', scope: 'openid profile email', expires_at: Math.floor(Date.now() / 1000) + 3600, profile: { sub: `${token}-sub`, name: `${token} Example`, email: `${token}@example.test`, 'cognito:groups': [group], ...claims } }))
  }, { token, group, claims })
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' })
}
// In-place log/history surfaces filter only: the date range and every export were
// moved to the gated Reports & Export page, so none of them may appear here.
async function assertFilterOnly(region) {
  assert.equal(await region.getByLabel('Start date (Manila)', { exact: true }).count(), 0, 'In-place filters must not expose a date range')
  assert.equal(await region.getByLabel('End date (Manila)', { exact: true }).count(), 0, 'In-place filters must not expose a date range')
  assert.equal(await region.getByRole('combobox', { name: 'Date preset', exact: true }).count(), 0, 'In-place filters must not expose date presets')
  assert.equal(await region.getByRole('combobox', { name: 'Date basis', exact: true }).count(), 0, 'In-place filters must not expose a date basis')
  assert.equal(await region.getByRole('button', { name: 'Generate report', exact: true }).count(), 0, 'In-place surfaces must not offer report export')
}
// The gated builder is inline (no dialog): preview, then assert on the region.
async function buildReport(builder) {
  await builder.getByRole('button', { name: /Preview report|Refresh preview/, exact: true }).click()
  const preview = builder.getByRole('region', { name: 'Report preview', exact: true })
  await visible(preview)
  return preview
}
try {
  // ---- Admin session log: in-place filters only (no dates, no export) ----
  await page.goto(`${base}admin/sessions`, { waitUntil: 'domcontentloaded' })
  const filters = page.getByRole('region', { name: 'Session log filters', exact: true })
  await visible(filters)
  await visible(page.getByRole('button', { name: /Peña Reviewer/ }).first())
  await assertFilterOnly(filters)
  assert.equal(await page.getByRole('button', { name: 'Generate report', exact: true }).count(), 0, 'The session log page must not offer export')
  assert(listRequests.some((url) => new URL(url).searchParams.get('nextToken')), 'Must retrieve beyond the first 200 sessions')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await visible(page.getByText(/Page 2 of/))
  await filters.getByRole('button', { name: 'Recorded role', exact: true }).click()
  await page.getByRole('checkbox', { name: 'student', exact: true }).click()
  await page.keyboard.press('Escape')
  await text(filters, '115 matching records')
  await visible(page.getByText(/Page 1 of/))
  assert(page.url().includes('sessions.filters'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await text(filters, '115 matching records')
  await filters.getByRole('button', { name: 'Remove Recorded role: student', exact: true }).click()
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await text(filters, '115 matching records')
  await filters.getByLabel('Search records', { exact: true }).fill('Niño')
  await visible(filters.getByRole('button', { name: 'Search: Niño' }))
  assert(!decodeURIComponent(page.url()).includes('Niño'), 'Personal search must not be in the URL')
  await filters.getByRole('button', { name: 'Reset all', exact: true }).click()
  assert.equal(await filters.getByLabel('Search records', { exact: true }).inputValue(), '')
  await visible(page.getByRole('button', { name: /Peña Reviewer/ }).first())
  await page.screenshot({ path: `${artifacts}/sessions-desktop.png`, fullPage: true })

  // ---- Session detail timeline: a filtered view only (no dates, no export) ----
  const row = page.getByRole('button', { name: /Peña Reviewer/ }).first()
  await row.focus()
  await page.keyboard.press('Enter')
  let dialog = page.getByRole('dialog').last()
  await visible(dialog.getByText('Session timeline appendix', { exact: true }))
  assert(!(await dialog.innerText()).includes('private=value'), 'Raw page-path query strings must never render')
  const sessionTimelineFilters = dialog.getByRole('region', { name: 'Session timeline appendix filters', exact: true })
  await visible(sessionTimelineFilters)
  await assertFilterOnly(sessionTimelineFilters)
  await page.keyboard.press('Escape')

  // ---- Admin activity log: in-place filters only ----
  await page.goto(`${base}admin/activities`, { waitUntil: 'domcontentloaded' })
  const activityFilters = page.getByRole('region', { name: 'Activity log filters', exact: true })
  await visible(activityFilters)
  await assertFilterOnly(activityFilters)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${artifacts}/activity-mobile.png`, fullPage: true })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile page must not overflow horizontally')
  await page.setViewportSize({ width: 1440, height: 1000 })

  // ---- Gated Reports & Export page (admin): date range + full export lifecycle ----
  await page.goto(`${base}admin/reports`, { waitUntil: 'domcontentloaded' })
  await visible(page.getByRole('combobox', { name: 'Report type', exact: true }))
  // Session log is the default type for a session viewer; its builder keeps dates.
  const sessionsBuilder = page.getByRole('region', { name: 'Session log report builder', exact: true })
  await visible(sessionsBuilder)
  await visible(sessionsBuilder.getByLabel('Start date (Manila)', { exact: true }))
  await visible(sessionsBuilder.getByRole('combobox', { name: 'Date preset', exact: true }))
  const preview = await buildReport(sessionsBuilder)
  await text(preview, '230 matching records')
  const csv = await download(sessionsBuilder, 'Detail CSV', '.csv')
  assert(csv.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])))
  assert(csv.toString('utf8').includes('Peña Reviewer'))
  assert(csv.toString('utf8').includes('s-000') && csv.toString('utf8').includes('s-229'), 'Downloads must contain every matching page')
  const pdf = await download(sessionsBuilder, 'Download PDF', '.pdf')
  assert(pdf.toString('latin1').startsWith('%PDF-'))
  assert((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length > 1)
  await page.screenshot({ path: `${artifacts}/session-report.png`, fullPage: true })

  // A prior successful preview must never remain usable after retrieval failure.
  const reportUrl = '**/api/v2/admins/monitor/sessions/report'
  const failedDownloads = []
  const onFailedDownload = (file) => failedDownloads.push(file.suggestedFilename())
  page.on('download', onFailedDownload)
  for (const code of ['REPORT_TOO_LARGE', 'RETRIEVAL_INCOMPLETE']) {
    await page.route(reportUrl, (route) => route.fulfill({ status: code === 'REPORT_TOO_LARGE' ? 422 : 503, contentType: 'application/json', body: JSON.stringify({ message: 'Narrow the date range and retry.', code }) }))
    await sessionsBuilder.getByRole('button', { name: /Refresh preview|Preview report/, exact: true }).click()
    await visible(sessionsBuilder.getByRole('alert').filter({ hasText: 'Narrow the date range' }))
    assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled())
    assert(await sessionsBuilder.getByRole('button', { name: 'Detail CSV', exact: true }).isDisabled())
    assert.equal(await sessionsBuilder.getByRole('region', { name: 'Report preview', exact: true }).count(), 0)
    await page.unroute(reportUrl)
  }
  await page.route(reportUrl, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { coverage: { retrieval_complete: false } } }) }))
  await sessionsBuilder.getByRole('button', { name: /Refresh preview|Preview report/, exact: true }).click()
  await visible(sessionsBuilder.getByRole('alert').filter({ hasText: 'Retrieval is incomplete' }))
  assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled())
  await page.unroute(reportUrl)

  let release
  const held = new Promise((resolve) => { release = resolve })
  await page.route(reportUrl, async (route) => { await held; await route.abort().catch(() => {}) })
  const started = page.waitForRequest((request) => request.url().endsWith('/sessions/report') && request.method() === 'POST')
  await sessionsBuilder.getByRole('button', { name: /Refresh preview|Preview report/, exact: true }).click()
  await started
  assert(await sessionsBuilder.getByRole('button', { name: 'Retrieving complete report…', exact: true }).isDisabled())
  await sessionsBuilder.getByRole('button', { name: 'Cancel retrieval', exact: true }).click()
  release()
  await visible(sessionsBuilder.getByRole('button', { name: 'Preview report', exact: true }))
  assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled())
  assert.equal(await sessionsBuilder.getByRole('region', { name: 'Report preview', exact: true }).count(), 0)
  await page.unroute(reportUrl)
  assert.deepEqual(failedDownloads, [], 'Failure or cancellation must not produce a file')
  page.off('download', onFailedDownload)

  // Filter and date changes invalidate the preview; empty and limited-coverage
  // results are handled without ever producing a stale download.
  await sessionsBuilder.getByRole('button', { name: 'Preview report', exact: true }).click()
  await visible(sessionsBuilder.getByRole('region', { name: 'Report preview', exact: true }))
  await sessionsBuilder.getByLabel('Search records', { exact: true }).fill('no-such-person')
  assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled())
  assert.equal(await sessionsBuilder.getByRole('region', { name: 'Report preview', exact: true }).count(), 0)
  await sessionsBuilder.getByRole('button', { name: 'Preview report', exact: true }).click()
  await visible(sessionsBuilder.getByText('No records match these dates and filters.'))
  const empty = await download(sessionsBuilder, 'Detail CSV', '.csv')
  assert(empty.toString('utf8').includes('No matching records'))
  await sessionsBuilder.getByLabel('Search records', { exact: true }).fill('')
  await sessionsBuilder.getByLabel('Start date (Manila)', { exact: true }).fill(new Date(Date.now() - 120 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }))
  await sessionsBuilder.getByRole('button', { name: 'Preview report', exact: true }).click()
  await visible(sessionsBuilder.getByText('Limited historical coverage', { exact: true }))
  assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isDisabled())
  await sessionsBuilder.getByRole('checkbox', { name: /I acknowledge the coverage limits/ }).check()
  assert(await sessionsBuilder.getByRole('button', { name: 'Download PDF', exact: true }).isEnabled())

  // Switching the report type remounts a fresh builder for the chosen collection.
  await select(page, 'Report type', 'Proposal statistics')
  const proposalsBuilder = page.getByRole('region', { name: 'Proposal statistics report builder', exact: true })
  await visible(proposalsBuilder)
  await text(await buildReport(proposalsBuilder), '12 matching records')
  await page.screenshot({ path: `${artifacts}/proposal-report.png`, fullPage: true })

  // Reservation changes are campus-scoped: the builder needs a campus selection.
  await select(page, 'Report type', 'Reservation-change history')
  await visible(page.getByRole('combobox', { name: 'Campus', exact: true }))
  await select(page, 'Campus', 'Campus 1')
  const changesBuilder = page.getByRole('region', { name: 'Reservation-change history report builder', exact: true })
  await visible(changesBuilder)
  await text(await buildReport(changesBuilder), '1 matching records')
  const campusCsv = await download(changesBuilder, 'Detail CSV', '.csv')
  assert(campusCsv.toString('utf8').includes('change-1'))
  assert(!campusCsv.toString('utf8').includes('change-2'))

  // ---- Student dashboard: in-place filters only, export removed ----
  await signIn('student', 'student', { 'custom:organization_id': 'org-1' }, 'students/dashboard')
  const proposalFilters = page.getByRole('region', { name: 'Proposal statistics filters', exact: true })
  const evaluationFilters = page.getByRole('region', { name: 'Post-evaluation history filters', exact: true })
  await text(proposalFilters, '12 matching records')
  await text(evaluationFilters, '2 matching records')
  await assertFilterOnly(proposalFilters)
  await assertFilterOnly(evaluationFilters)
  assert.equal(await page.getByRole('button', { name: 'Generate report', exact: true }).count(), 0, 'The student dashboard must not offer export')
  await proposalFilters.getByRole('button', { name: 'Current status', exact: true }).click()
  await page.getByRole('checkbox', { name: 'denied', exact: true }).click()
  await page.keyboard.press('Escape')
  await text(proposalFilters, '6 matching records')
  await text(evaluationFilters, '2 matching records')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await text(proposalFilters, '6 matching records')
  await text(evaluationFilters, '2 matching records')
  await proposalFilters.getByRole('button', { name: 'Reset all', exact: true }).click()
  await text(proposalFilters, '12 matching records')

  // The proposal timeline is a filtered view; export and dates were removed.
  await page.getByRole('button').filter({ hasText: 'Forum 0' }).first().click()
  await page.getByRole('button', { name: 'Milestone & Progress', exact: true }).click()
  await visible(page.getByText('Proposal timeline appendix', { exact: true }))
  dialog = page.getByRole('dialog').last()
  const proposalTimelineFilters = dialog.getByRole('region', { name: 'Proposal timeline appendix filters', exact: true })
  await visible(proposalTimelineFilters)
  await assertFilterOnly(proposalTimelineFilters)
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${artifacts}/student-history.png`, fullPage: true })

  // Reports & Export is gated: a student must be denied outright.
  await page.goto(`${base}admin/reports`, { waitUntil: 'domcontentloaded' })
  await visible(page.getByText('Access Denied', { exact: true }))
  assert.equal(await page.getByRole('combobox', { name: 'Report type', exact: true }).count(), 0, 'Students must not reach the Reports & Export builder')

  // ---- OSAAR: in-place post-eval filters, then the gated builder (no session log) ----
  await signIn('osaar', 'osaar', { 'custom:signatory_id': 'sig-osaar' }, 'osaar/postevals')
  await text(evaluationFilters, '3 matching records')
  await assertFilterOnly(evaluationFilters)
  await evaluationFilters.getByRole('button', { name: 'Organization', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Peña Society', exact: true }).click()
  await page.keyboard.press('Escape')
  await text(evaluationFilters, '2 matching records')

  await signIn('osaar', 'osaar', { 'custom:signatory_id': 'sig-osaar' }, 'osaar/reports')
  await visible(page.getByRole('combobox', { name: 'Report type', exact: true }))
  await page.getByRole('combobox', { name: 'Report type', exact: true }).click()
  assert.equal(await page.getByRole('option', { name: 'Session log', exact: true }).count(), 0, 'OSAAR must not export the session log')
  await page.getByRole('option', { name: 'Post-evaluation history', exact: true }).click()
  const osaarBuilder = page.getByRole('region', { name: 'Post-evaluation history report builder', exact: true })
  await visible(osaarBuilder)
  await text(await buildReport(osaarBuilder), '3 matching records')
  await download(osaarBuilder, 'Detail CSV', '.csv')
  await page.screenshot({ path: `${artifacts}/signatory-history.png`, fullPage: true })

  await page.goto(`${base}osaar/review/dashboard`, { waitUntil: 'domcontentloaded' })
  await text(proposalFilters, '12 matching records')
  await assertFilterOnly(proposalFilters)

  // ---- CDM reviewer: in-place reservation-change filters only ----
  await signIn('cdm', 'cdm_reviewer', { 'custom:signatory_id': 'sig-cdm' }, 'cdm/reservations?reservation-campus=campus-1')
  const reservationFilters = page.getByRole('region', { name: 'Reservation-change history filters', exact: true })
  await text(reservationFilters, '1 matching records')
  await assertFilterOnly(reservationFilters)
  await reservationFilters.getByRole('button', { name: 'Request type', exact: true }).click()
  await page.getByRole('checkbox', { name: 'cancel', exact: true }).click()
  await page.keyboard.press('Escape')
  await select(page, 'Campus', 'Campus 2')
  await text(reservationFilters, '1 matching records')
  assert.equal(await reservationFilters.getByRole('button', { name: 'Remove Request type: cancel', exact: true }).count(), 0)
  await page.getByRole('button').filter({ hasText: 'Forum 1' }).first().click()
  await visible(page.locator('button[aria-current="true"]'))
  await page.goBack({ waitUntil: 'domcontentloaded' })
  await visible(reservationFilters.getByRole('button', { name: 'Remove Request type: cancel', exact: true }))
  assert.equal(await page.locator('button[aria-current="true"]').count(), 0, 'Campus back-navigation clears selected request')
  await page.screenshot({ path: `${artifacts}/reservation-history.png`, fullPage: true })

  assert.deepEqual(errors, [], 'No browser runtime errors')
  console.log(`Reporting browser flows passed; screenshots/downloads: ${artifacts}`)
} catch (error) {
  await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
  console.error(`URL: ${page.url()}\n${(await page.locator('body').innerText()).slice(0, 9000)}`)
  throw error
} finally {
  await browser.close()
}
