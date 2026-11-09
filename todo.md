# Deferred Work — TODO

Items intentionally deferred out of the post-evaluation overhaul. They are
tracked here so they are not lost, but are **not** part of the current change.

## 3. Proponent position spelling

**Status:** Not started.

**Goal:** Stop free-typed position text from being saved with the wrong
spelling. The same check applies to every field that should be a known value,
not only position.

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
