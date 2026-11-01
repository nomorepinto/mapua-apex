import { registerHooks } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Node 24 executes the existing pure TypeScript utilities without a test dependency.
// From the repository root: node --experimental-transform-types --test mapua-apex-frontend/scripts/reporting.test.mjs
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context) } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !specifier.startsWith('.')) throw error
    return nextResolve(specifier.endsWith('.js') ? specifier.slice(0, -3) + '.ts' : specifier + '.ts', context)
  }
} })
const ui = await import('../src/lib/reporting.ts')
const server = await import('../../mapua-apex-backend-nest/src/common/reporting.ts')
const { csvContent } = await import('../src/lib/export-csv.ts')
const { assertExportable, reportCsvData } = await import('../src/lib/report-export.ts')
const { createReportPdf, validatePdfText } = await import('../src/lib/report-pdf.ts')
const { timelineReport, sessionTimeline, proposalTimeline, freezeReport } = await import('../src/lib/timeline-reporting.ts')
const filters = { start_date: '2024-02-29', end_date: '2024-02-29' }
const fixture = (id, extra = {}) => ({ event_id: 'e', submission_id: id, organization_id: 'org', organization_name: 'Peña Society', first_submitted_at: '2024-02-28T16:00:00Z', first_submitted_at_source: 'recorded', status: 'approved', activity_details: { title_and_nature: 'Niño’s Forum', date_of_event: '2024-02-28', end_date_of_event: '2024-03-01' }, ...extra })
const payload = async (rows = [fixture('1')]) => server.generateReport('proposals', { filters }, 'Test scope', async () => rows)

test('Manila presets, leap days, year boundaries, and invalid ranges', () => {
  assert.equal(ui.manilaToday(new Date('2024-12-31T16:00:00Z')), '2025-01-01')
  assert.equal(ui.validCalendarDate('2023-02-29'), false)
  assert.equal(ui.validCalendarDate('2024-02-29'), true)
  assert.deepEqual(ui.presetRange('Last month', new Date('2024-03-01T00:00:00Z')), { start_date: '2024-02-01', end_date: '2024-02-29' })
  assert.ok(ui.dateRangeError({ start_date: '2024-03-01', end_date: '2024-02-29' }))
  assert.ok(ui.dateRangeError({ start_date: '2024-01-01', end_date: '2025-01-01' }))
})
test('collection definitions and filter behavior match the backend', () => {
  for (const [kind, definition] of Object.entries(server.REPORT_DEFINITIONS)) {
    assert.deepEqual(Object.keys(ui.REPORTS[kind].dates), definition.dates)
    assert.deepEqual(Object.keys(ui.REPORTS[kind].facets), Object.keys(definition.facets))
    assert.deepEqual(Object.keys(ui.REPORTS[kind].columns), Object.keys(definition.columns))
    assert.deepEqual(ui.REPORTS[kind].defaults, definition.defaults)
  }
  const rows = [fixture('2'), fixture('1'), fixture('3', { status: 'denied' }), fixture('4', { first_submitted_at: '2024-02-29T16:00:00Z' }), fixture('5', { first_submitted_at: undefined }), fixture('6', { organization_id: 'other' })]
  for (const date_basis of ['first_submitted_at', 'latest_submitted_at', 'event_date']) {
    for (const sort of ['asc', 'desc']) {
      const applied = server.parseFilters('proposals', { ...filters, date_basis, sort, values: { status: ['approved', 'pending'], organization_id: ['org'] }, search: 'Forum' })
      assert.deepEqual(ui.filterRecords('proposals', rows, applied), server.filterItems('proposals', rows, applied))
    }
  }
  assert.deepEqual(ui.filterRecords('proposals', rows, { ...filters, sort: 'asc' }).map((r) => r.submission_id), ['1', '2', '3', '6'])
})
test('URL state excludes personal searches, actors and paths; malformed state fails closed', () => {
  const privateState = { ...filters, search: 'private@email.test', values: { actor_id: ['private-user'], path: ['/private'], organization_id: ['org'] } }
  const serialized = JSON.stringify(ui.publicFilterState(privateState))
  assert.ok(!serialized.includes('private'))
  assert.deepEqual(ui.restoreFilters('proposals', '{invalid', filters), filters)
  assert.deepEqual(ui.restoreFilters('proposals', JSON.stringify({ ...filters, end_date: '2024-02-30' }), filters), filters)
  assert.equal(ui.restoreFilters('proposals', JSON.stringify(privateState), {}).search, undefined)
})
test('CSV preserves accents, quotes and newlines and neutralizes formulas without corrupting numeric negatives', () => {
  const csv = csvContent(['Name', 'Value'], [['Peña, Niño "Jr"', '=SUM(A1)'], ['Line\nTwo', '\t+cmd'], ['@name', '-danger'], ['\u0000=cmd', -42], ['+cmd', true]])
  assert.ok(csv.startsWith('\ufeff'))
  assert.ok(csv.includes('\r\n'))
  assert.ok(csv.includes('"Peña, Niño ""Jr"""'))
  for (const dangerous of ['=SUM(A1)', '\t+cmd', '@name', '-danger', '\u0000=cmd', '+cmd']) assert.ok(csv.includes(`"'${dangerous}"`))
  assert.ok(csv.includes('"-42"'))
})
test('zero-result CSV retains report metadata and explicit result text', async () => {
  const report = await payload([])
  const csv = reportCsvData(report, 'details')
  assert.equal(csv.rows.length, 1)
  assert.equal(csv.rows[0].length, csv.headers.length)
  assert.ok(csv.rows[0].includes('No matching records'))
  assert.ok(csv.rows[0].includes('2024-02-29'))
})
test('incomplete and unacknowledged limited reports cannot produce usable files', async () => {
  const report = await payload()
  report.coverage.retrieval_complete = false
  assert.throws(() => assertExportable(report, true), /Incomplete/)
  assert.throws(() => createReportPdf(report, true), /Incomplete/)
  report.coverage.retrieval_complete = true
  report.coverage.historical_coverage_complete = false
  assert.throws(() => assertExportable(report, false), /Acknowledge/)
  assert.doesNotThrow(() => assertExportable(report, true))
})
test('PDF handles accented names, repeated page headers, landscape details and page numbers', async () => {
  const report = await payload(Array.from({ length: 250 }, (_, i) => fixture(String(i))))
  report.columns.push({ key: 'department', label: 'Department' })
  const doc = createReportPdf(report, true)
  assert.ok(doc.getNumberOfPages() > 3)
  const text = doc.output()
  assert.ok(text.includes('Mapúa'))
  assert.ok(text.includes('Peña'))
  assert.ok(text.includes(`Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`))
  assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight())
  assert.ok(text.split('(Current status)').length > 2)
  assert.throws(() => validatePdfText('Unsupported 漢字'), /UTF-8 CSV/)
})
test('timeline appendix is record-scoped, date-filtered, private by default and deeply frozen', () => {
  const source = proposalTimeline([{ submission_id: 's', sent_at: '2024-02-29T00:00:00Z', notif_type: 'approved', signatory: 'Peña', comment: 'private remarks' }], 's')
  assert.throws(() => proposalTimeline([{ submission_id: 'other' }], 's'), /unrelated/)
  const report = timelineReport('proposal_timeline', source, { filters, sections: ['summary', 'details'], columns: ui.REPORTS.proposal_timeline.defaults, compare_previous_period: true }, 'Opened proposal e:s', '2024-02-29T00:00:00Z')
  assert.equal(report.total_count, 1)
  assert.equal(report.rows[0].remarks, undefined)
  assert.equal(report.comparison.percent_change, null)
  const frozen = freezeReport(report)
  assert.throws(() => { frozen.rows[0].actor = 'changed' }, TypeError)
  report.rows[0].actor = 'changed original'
  assert.equal(frozen.rows[0].actor, 'Peña')
})
test('page paths lose query strings and stored caps require coverage acknowledgment', () => {
  const source = sessionTimeline({ sessionId: 's', pagesVisitedTruncated: true, pagesVisited: [{ timestamp: '2024-02-29T00:00:00Z', pageName: 'Dashboard', path: '/students?secret=private#fragment' }] })
  const report = timelineReport('session_timeline', source, { filters, sections: ['details'], columns: ['date', 'path'], compare_previous_period: false }, 'Opened session s', '2024-02-29T00:00:00Z')
  assert.equal(report.rows[0].path, '/students')
  assert.equal(report.coverage.historical_coverage_complete, false)
  assert.throws(() => assertExportable(report, false), /Acknowledge/)
  assert.ok(!JSON.stringify(report).includes('secret'))
})
