# Deferred Work — TODO

Items intentionally deferred out of the post-evaluation overhaul. They are
tracked here so they are not lost, but are **not** part of the current change.

## ~~1. TTL sentinel + Streams → auto-`cancelled` status~~

**Status:** Closed — implemented as a `CANCELWATCH#<submissionId>` sentinel with
the table's `TTL` attribute (uppercase, epoch seconds) written at final approval
and deleted on post-eval submit; a DynamoDB Streams (KEYS_ONLY) consumer Lambda
handles the resulting `REMOVE`, re-checks for a `POSTEVAL#` child, and
conditionally cancels the SUBMISSION (`status = cancelled` + `cancelled_at`)
when the window lapsed with no post-eval. Adds a timeline notice
(`notif_type "event auto-cancelled"`) + student email, the frontend notif-type
wiring (`ReviewNoticeModal` / `reminders-panel` / `dynamodb-adapters`), an
`ARCUS_AUTO_CANCEL_ENABLED` kill-switch (default on), a boto3 provisioning
script (`mapua-apex-frontend/scripts/deploy_cancelwatch_lambda.py`), and a
Playwright `cancel-watch` phase. (Historical note: this text still refers to a
lowercase `ttl` and a PHP window helper; the shipped code uses `TTL` and
`src/common/manila.ts`.) Original status below.

**Goal:** When an event's 3-day post-evaluation window lapses with **no**
submitted post-eval, automatically set the linked SUBMISSION
`status = cancelled` (+ `cancelled_at`).

**Design:**
- **Sentinel item** per approved event: `PK = EVENT#{uuid}`,
  `SK = CANCELWATCH#{submissionId}`, `ttl` = end-of-day(`date_of_event`) +
  `post_evaluation_window_days`. New child prefix — does not collide with
  arcus `MEMBER#` / `EVALUATION#` children or `AggregateEventParticipants`
  queries. Never put `ttl` on the SUBMISSION/EVENT parent itself (every
  unrelated update would have to carry it).
- **Lifecycle:** created at final approval (window start); `DeleteItem` on the
  sentinel when the post-eval is submitted (belt); the stream re-check below
  is the suspenders.
- **Consumer:** DynamoDB Streams on the shared `mapua-apex` table (must be
  enabled — operational/console setting) → Lambda filtering to
  `eventName = REMOVE` + `SK` begins with `CANCELWATCH#` only (the stream
  carries all three apps' traffic).
- **Handler logic (re-check, never trust cross-key stream ordering):** query
  `PK = EVENT#{uuid}` for a `POSTEVAL#` child — present → no-op; absent →
  patch the SUBMISSION to `cancelled` conditioned on `attribute_exists` and
  the status still being its pre-post-eval value (idempotent under
  at-least-once replay; never overwrites `finished`/reviewed).

**Notes:**
- Add `cancelled` to the submission status enum at that time (it is reserved
  in the docs now but not produced by any code path yet).
- The window length is `services.arcus.post_evaluation_window_days` (default 3);
  the stateless window logic lives in `app/Support/Arcus/EventWindow.php`.
- Accepted caveat: TTL deletion is best-effort with no SLA — AWS docs note
  occasional multi-hour lag. Harmless for this deadline; document it.

## ~~2. Room suggestion by participant count~~

**Status:** Closed — `suggestRooms()` in `mapua-apex-frontend/src/lib/reservable-capacity.ts` ranks the campus rooms for the SAAF headcount (best fit first, smallest sufficient ceiling wins; when nothing fits, the closest rooms, largest first) and `components/students/reservations/room-suggestions.tsx` renders them as an advisory "Suggested for N participants" panel with a one-click Add above the room dropdown in `reservation-form.tsx`. Advisory only — the dropdown, the picks, and the existing capacity warnings are untouched, and booked or closed rooms are never offered.

**Goal:** Suggest a room from the number of participants.

## 3. Proponent position spelling

**Status:** Not started.

**Goal:** Stop free-typed position text from being saved with the wrong
spelling. The same check applies to every field that should be a known value,
not only position.

## ~~4. e2e-tests coverage for the Reports & Export restructure~~

**Status:** Closed — already wired into the `e2e-tests/` suite (committed in
`fb17f19`): `tests/reports.spec.ts` + `pages/reports.page.ts` (admin builds and
exports every report type, OSAAR loses the Session log — the
`REPORT_EXPORT_GROUPS` / `session_admin` gating — and CSV download is asserted),
`tests/monitor.spec.ts` + `pages/monitor.page.ts` (in-place log monitors and
group gating), the `reports` project in `playwright.config.ts` (depends on
`monitor`), and the `reports` phase in `run_e2e.py`. This item's Status line was
simply stale.

**Goal:** Per the AGENTS.md "E2E Suite" rule (added on `origin/master`), the
user-visible reporting restructure should be covered by the `e2e-tests/`
Playwright suite: date range + PDF/CSV export moved to the gated
`/admin/reports` and `/osaar/reports` pages (`REPORT_EXPORT_GROUPS` = admin,
super_admin, osaar); in-place log/history filters and record timelines made
filter-only; report endpoints gated to `report_admin` (sessions stay
`session_admin`); student/signatory report endpoints removed.

**Notes:**
- No current `e2e-tests` project owns reports/monitor behavior, so this needs a
  new spec under `e2e-tests/tests/`, a page object under `e2e-tests/pages/`, a
  project in `e2e-tests/playwright.config.ts` that depends on the projects it
  needs, and a `--phase` choice in `e2e-tests/run_e2e.py`.
- Already covered elsewhere: `mapua-apex-frontend/scripts/report-browser.test.mjs`
  (Playwright harness) and backend `test/reports.e2e-spec.ts` (17 tests, green).
- Running the suite needs `npm ci` + `playwright install` inside `e2e-tests/`,
  live backend + frontend servers, and Cognito test users — deferred until that
  environment is available.

## 5. Cognito API login for the arcus apps (replace hosted UI)

**Status:** Not started.

**Goal:** Log the user in by calling the Amazon Cognito API directly from an
in-app login form, instead of redirecting to the Cognito-hosted login pages,
so the arcus companion apps (`arcus-attendance-system`,
`arcus-evaluation-system`) keep the user inside their own UI for the whole
session. The direct-API access is also the point of the change: it lets the
backend provision accounts through an SQS-buffered writer instead of hitting
Cognito synchronously, which throttles during event-day sign-up bursts.

**Design — login flow:**
- Use the Cognito **`AUTHORIZE_API` flow** (`POST /v2/authorize` with the
  `SRP_*` secure-password steps) called from the Next.js server actions, not
  the browser. Tokens are obtained server-side and stored in an HttpOnly,
  Secure session cookie — the same session shape `apex-branch` already
  ships (`proxy.ts`, `session.ts`, callback/refresh/logout), so only the
  token *acquisition* changes, not the session plumbing.
- Delete the hosted-UI leg: no `/login` → `.../oauth2/authorize` redirect,
  no `/callback` code exchange. PKCE is unnecessary; this flow authenticates
  the resource owner directly (public-client app, no client secret — this is
  an exception to the general "never handle user passwords" rule, acceptable
  for first-party apps).
- Handle the non-happy paths the hosted UI did for free: `CUSTOMER_PROVIDER`
  (force-new-password on first login), password reset, sign-up confirmation,
  and MFA challenges (`SMS_MFA` / `SOFTWARE_TOKEN_MFA`), each as its own form
  state on the same page.
- Reuse one Cognito user pool and app client as the hosted-UI flow today
  (same `custom:organization_id` claim routing: org claim → `/scanner`, no
  claim → `/`). Migration is additive — the hosted UI can stay enabled during
  rollout and be disabled once the form is proven.

**Design — SQS-buffered Cognito account creation:**
- **Problem:** during an event, hundreds of near-simultaneous account
  creations blow through **two** shared, region-wide Cognito write quotas,
  each breach surfacing as a dead form (or a silently mis-provisioned
  account) at the worst moment. The **binding** one is `UserUpdate` at
  **25 RPS — not adjustable via Service Quotas** (only a Support case):
  the current orgassign `PostConfirmation` trigger fires *two* `UserUpdate`
  calls per student (`AdminUpdateUserAttributes` for `custom:organization_id`,
  then `AdminAddUserToGroup`), so a registration burst caps at roughly
  **12 students/sec** — well before the `UserCreation` quota
  (`SignUp` / `ConfirmSignUp` / `AdminCreateUser`, **50 RPS**, adjustable) is
  reached. Buffering only `AdminCreateUser` leaves the tighter limit in place;
  the consumer must absorb the `UserUpdate` ops too.
- **Producer:** the account-request endpoint never calls Cognito inline. It
  validates the payload, writes a status item
  `PK = SK = PROCOG#<studentId>` (`status = pending`, `requested_at`), and
  enqueues `{studentId, name, email, organizationId}` to a
  standard SQS queue (response time ≈ one DynamoDB put + one `SendMessage`).
- **Consumer:** a Lambda polls the queue with `BatchSize` ≈ 10 and
  `ReportBatchItemFailures` so one poisoned message doesn't redrive the
  whole batch. Per record it calls `AdminCreateUser`, then
  `AdminSetUserSettings` (MFA), `AdminUpdateUserAttributes`
  (`custom:organization_id`), and `AdminAddUserToGroup` — the same writes the
  current `PreSignUp_SignUp` / `PostConfirmation` trigger chain performs,
  moved inline (which is exactly what lets the tight `UserUpdate` quota be
  paced in one place instead of smeared across a synchronous trigger; the
  orgassign trigger is then retired for these two calls). Size the drain rate
  against the binding `UserUpdate` 25 RPS, **not** `UserCreation`: with the
  two `UserUpdate` ops per record, `ReservedConcurrentExecutions` must keep
  the consumer at **≤ ~12 registrations/sec (≤ 25 `UserUpdate` ops/sec)** so
  Cognito never sees the burst. `ApproximateAgeOfOldestMessage` on the queue
  is the burst alarm.
- **Drain semantics:** queue + consumer absorb the spike; Cognito is written
  at a steady, quota-compliant rate; nothing is lost and no caller retries
  are needed. The queue is the buffer, the consumer is the rate limiter.
- **Status path for UX:** the client polls
  `GET /api/v1/auth/provision-status/{studentId}`, which reads the
  `PROCOG#` item the consumer patches to `ready` / `failed(code)`;
  sign-in is offered once `ready`. Give the item a TTL (e.g. 7 days) so
  the partition self-cleans. Alternatively, if auto-verifying e-mail is
  acceptable, the consumer can `AdminConfirmSignUp` so the user is usable
  without a confirmation hop — decide at implementation time.
- **Failure handling:** DLQ redrive (maxReceiveCount 5). Classify
  `UsernameExistsException` as *already provisioned* → mark `ready`, never
  retry; classify invalid-input faults (`InvalidParameterException`,
  `InvalidPasswordException`) as permanent → mark `failed` and drop;
  everything else retries with backoff. Idempotency check
  (`AdminGetUser` first) makes message replay safe.
- **Login side:** `AUTHORIZE_API` must surface `UserNotFoundException` /
  `NotConfirmedException` as "account still being created — try again in a
  few minutes" rather than a generic auth error.
- **IAM:** the consumer role gets `sqs:ReceiveMessage/DeleteMessage` on the
  queue and `cognito-idp:AdminCreateUser,AdminSetUserSettings,
  AdminUpdateUserAttributes,AdminAddUserToGroup,AdminGetUser` scoped to this
  pool ARN only (and `cognito-idp:GetGroup` on the target group ARN).
  `AdminAddUserToGroup` is new here — it lives in the `UserUpdate` category,
  the 25 RPS ceiling the drain rate is tuned against. No
  Lambda is allowed to call `SignUp` unauthenticated.

**Notes / risks:**
- The hosted UI keeps credentials provably outside the app; a self-built form
  moves that burden here — compensate with Cognito password policies,
  adaptive authentication / risk-based MFA, CAPTCHA on the login endpoint
  (advanced security features), and rate limiting at the Next.js route.
- No history exists yet in these repos for direct-API auth; `apex-branch`
  carries the full hosted-UI stack, so treat this as a replacement of that
  flow, not an additional one.

## 6. OSAAR term start / term end settings

**Status:** Not started.

**Goal:** Let OSAAR define an academic term window. Two rules follow from it:
(a) once a term is within **two weeks of its term-end date**, no new events
may be filed for the remainder of that term, and (b) OSAAR can set **blackout
date ranges** during which no events may be scheduled at all.

**Design:**
- **Storage:** a new singleton item `PK = SK = OSAAR#TERM` holding
  `term_start`, `term_end` (ISO dates), `academic_year` label, and
  `blackouts` as a list of `{start, end, reason}` ranges. Single item, admin
  editable, cheap `GetItem` on every validation — no GSI needed.
- **Config surface:** OSAAR settings page (date pickers + blackout list with
  add/remove), backed by `PUT /api/v1/osaar/term` gated to the OSAAR role;
  every write logged to the activity log (who moved the term / added a
  blackout, with the old value).
- **Enforcement is server-side, in the submission/event-date validator:**
  reject a filing when `date_of_event` falls inside the final two weeks of
  the active term, or inside any blackout range. Client-side date pickers
  only *grey out* blocked dates as guidance — they are never the check.
- Put the window math next to the existing
  `app/Support/Arcus/EventWindow.php` as a stateless
  `TermWindow::assertDateAllowed($date, $term, $blackouts)` helper so both
  the file-proposal flow and any later event-editing flow call one function.
- The two-week cutoff should be a config value
  (`osaar.term_lockout_days`, default 14), not a literal, mirroring how
  `post_evaluation_window_days` is handled.

**Notes:**
- Decide explicitly whether the lockout blocks *filing* only or also
  *rescheduling* of already-approved events; the validator placement above
  covers both if applied on every date write.

## ~~7. Signatory contact information on the student side~~

**Status:** Closed — SIGNATORY items carry `contact_email` / `office` / `contact_number`, maintained on the admin signatory screen (add card, edit dialog, and a new Contact column); `GET /api/v2/students/events/{event}/submissions/{submission}` alone derives `approval_chain_contacts` from the desk holding the paper onward (OSAAR links stand in once the paper is decided), and a new "Signatories" tab in `SubmissionTrackerModal.tsx` renders it in approval order with the current desk highlighted and plain `mailto:` / `tel:` links. Deviation from the design below: the chain comes from the submission's own frozen `signatory_steps` rather than the organization's `signatories[]` map, so a paper keeps the desks it was filed with, and each entry also carries `signatory_id`, `organization_name`, `contact_number`, and `is_current`.

**Goal:** Show the approving signatories' contact information — e-mail, and
office/phone where available — in a dedicated tab inside the proposal modal
the student sees, so the proponent can follow up with the desk instead of
e-mailing OSAAR blindly.

**Design:**
- Source data is the SIGNATORY items referenced by the organization's
  `signatories[]` role→id map (`GSI2PK = SIGNATORY#uuid` inbox items already
  carry the signatory record); extend those items with `contact_email`
  (and optionally `office`, `contact_number`) maintained on the admin
  signatory screen.
- **Response shape:** the proposal-detail endpoint gains an
  `approval_chain_contacts` array — one entry per signatory currently in or
  next in the student's approval chain (`name`, `role`, `contact_email`,
  `office`) — rather than exposing the full signatory directory.
- **Frontend:** a "Signatories" tab in the existing proposal modal
  (student dashboard) rendering the chain in approval order with the current
  desk highlighted; plain `mailto:` links, no new pages.
- Gate the contact fields to authenticated students viewing **their own**
  proposal only; the list endpoints must not serialize them.

## 8. Ever-present footer with bug reporting

**Status:** Partially done — the ever-present footer shipped (and was repaired
after it covered page content); the in-product capture pipeline is still
deferred. A slim footer bar now renders on every screen of all three apps
(`mapua-apex-frontend` `SiteFooter` mounted in `main.tsx`; arcus-attendance
`AppFooter` and arcus-evaluation `SiteFooter` mounted in their root
`layout.tsx`), carrying the single line "Email mapuaapex@gmail.com for bug
reports" as a `mailto:` link. **Layout fix (Nov 6, 2026):** the bar was
`position: fixed`, so it painted over the bottom of the viewport — on desktop
app screens the `lg:h-dvh` frame left no clearance at all and the last rows of
scrollable content were permanently hidden, and on scrolling pages (landing,
error/404) content slid under the opaque strip. The bar is now an in-flow strip
that owns its own `--site-footer-h` band: `layout.frame` ends at
`calc(100dvh - var(--site-footer-h))` at every breakpoint (the `lg:h-dvh` and
`lg:left-64` overrides are gone), `#root` no longer pads its bottom, and
`layout.center` / `layout.fallback`, the landing root, and the error/404 shells
use the same calc. On app screens the strip stays pinned to the viewport
bottom; on document-flow pages it sits at the end of the content.
Still open: the in-product capture below (DynamoDB `BUG#` partition,
`POST /api/v1/bug-reports`, admin `GET/PATCH` review list, and the report dialog)
so issues are stored in-product instead of by e-mail.

**Goal:** A persistent footer on every screen (public, student, OSAAR, and
arcus app surfaces) that carries a "Report a bug" entry point, so issues are
captured in-product instead of by e-mail.

**Design:**
- **Storage:** a `BUG#` partition on the shared `mapua-apex` table
  (`PK = SK = BUG#{uuid}`, plus `GSI1PK = "BUG"` ordered by timestamp for the
  admin list) holding description, optional email, page path, user agent,
  submitted-by (from session when signed in; anonymous allowed), `status`
  (`open` / `resolved`), and timestamps. Attribute-light single writer —
  `PutItem` is safe here (single-owner key).
- **Endpoints:** `POST /api/v1/bug-reports` (public, rate-limited per IP,
  server-side length/validation, honeypot field to deter bots) and
  `GET/PATCH /api/v1/admin/bug-reports` gated to admins for the review list.
- **Frontend:** one shared `<SiteFooter>` mounted in the root layout of each
  app; the bug dialog is a small form (what/where/optional contact) — no
  screenshot upload in v1.
- Optional later: e-mail or activity-log notification to admins on new
  reports, reusing the existing notification pipeline.

## 9. Penetration test using agent skills

**Status:** Not started.

**Goal:** Run a structured security assessment of the platform using the
available agent skills, producing a written findings report and prioritized
fixes before the next release.

**Design:**
- **Static pass:** the `security-scan` skill for the full-repo cloud scan
  (secrets, dependency vulnerabilities, misconfiguration across the three
  apps + Lambda repos), and `code-quality-audit` for tool-driven checks
  (ESLint/Trivy/Gitleaks/Semgrep on the Next.js apps, the equivalent chain on
  the backend).
- **Dynamic pass (manual, agent-directed):** targeted probing of the
  attack surfaces that automated scanning cannot reach —
  auth/authorization matrix (role gates on report/session endpoints,
  `ARCUS_SERVICE_TOKEN` endpoints, the `PATCH /api/member` open passthrough
  on the arcus scanee flow), IDOR on submission/proposal IDs, token handling
  after the item-5 login change, upload/CSV import paths, and rate limiting
  on login and bug-report endpoints.
- **Reporting:** findings written to `docs/` with OWASP ASVS categories,
  severity (P0–P3), repro steps, and affected files; P0/P1 fixes gated before
  deployment, P2/P3 appended to this todo list as numbered items.
- This is a scoped assessment against staging with test data — not
  production, and not a substitute for an external certified pen test.
