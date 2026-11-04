# One product bug from the APEX end-to-end suite

You are one pass of a fix loop. The shell already ran `python run_e2e.py` and will run it again after you finish. You handle the single failure named in the task file, then stop.

## What counts as a product bug

A product bug is the application doing the wrong thing while the test is checking the behavior the app is supposed to have.

These are not product bugs. Do not edit code for them:

- A server, login, AWS, DynamoDB, Cognito, or cleanup failure
- A step the suite marked as a gap
- A test that expects the wrong behavior, calls the wrong route, or built the wrong fixture
- A failure you cannot explain from the application source

## Rules

- Fix one bug: the step named in the task file. Leave every other failure for the next pass.
- Change application code in `mapua-apex-backend-nest`, `mapua-apex-frontend`, `arcus-attendance-system`, or `arcus-evaluation-system`.
- You may edit `e2e-tests/support/**` and `e2e-tests/pages/**` (harness helpers and page objects) to fix locator drift or auth flow changes. Do not edit `e2e-tests/tests/**` (specs) or flip a failure into a gap, skip an assertion, or loosen a test to make the run pass.
- Do not edit this prompt or the loop script.
- Do not open `.env`, `.env.*`, `.grokadmin`, or `accounts.local.json`.
- Do not run `git commit`, `git add`, `git push`, or `git reset`. The loop commits after you exit.
- Do not start a new test run. The loop does that.
- Base every verdict on evidence you actually gathered: a command's output, a file you opened, a log line. Never state a fact about a file, field, or run state you did not read. If, after honest investigation, you cannot explain the cause, write the verdict that fits (`test` or `environment`) with a summary that says exactly what you verified and what is still unexplained. Do not invent a plausible-sounding reason to end the pass early.

## Verdict

Write the verdict file to the path given in the task file, under `.ralph/e2e-fix-loop`. When you are not fixing a product bug, that verdict file is the only file you write.

```json
{
  "kind": "product",
  "summary": "One sentence on the cause and the fix.",
  "commit_message": "fixed the specific behavior"
}
```

`kind` is `product`, `test`, or `environment`.

- `product`: you changed files (application code OR harness helpers under `e2e-tests/support/**` / `e2e-tests/pages/**`). `commit_message` is one lowercase line, under 72 characters, in the same style as `fixed routes`. No ticket id, no period, no secret. The loop commits your changes only when kind is `product`.
- `test`: the spec or fixture is wrong and you changed NO files. Say why in `summary`.
- `environment`: AWS/Cognito/DynamoDB config issue and you changed NO files. Before giving up, check if a boto3 script in `mapua-apex-frontend/scripts/` could fix it (e.g., `add_cognito_arcus_callbacks.py` for redirect URLs, `add_cognito_client_scopes.py` for OAuth scopes). If a script exists or could be written, say so in `summary` and set `kind` to `product` instead. Only use `environment` if the fix requires manual AWS console work or credentials the loop doesn't have.

Diagnosing an empty Arcus event dropdown (a scanner/officer `getByRole("option", { name: /<event title>/ })` times out, or the events list is blank). The backend publishing chain has been proven correct for this suite, so work these steps in order and stop as soon as one explains the failure:
1. Curl the local backend directly, unscoped, to see whether it publishes the event at all: `curl -H "X-Arcus-Service-Token: <token>" "http://127.0.0.1:3000/api/v2/arcus/events?window=attendance"`. The Nest global prefix is `api/v2`; the token is the `ARCUS_SERVICE_TOKEN` value; the response envelope is `{ "data": [...] }`. To scope it the way the officer's session does, add `-H "X-Arcus-Organization-Id: <org uuid>"`.
2. If the expected event IS in that list (matching title, `status: approved`, `date_of_event` = today, the officer's `organization_id`), the backend is fine and the empty dropdown is a browser/harness symptom, NOT a backend bug. The usual causes are a degraded officer sign-in (see `hostedLogin` in `e2e-tests/support/auth.ts`: Cognito managed login reveals the password only after a Next click, and the SPA renders that button asynchronously) or the Next dev server still lazily compiling `/api/apex/events` on the first hit. Both are already handled with polls: `hostedLogin` re-clicks Next via `expect.poll` until the password renders, and `AttendancePage.scanFile` / `EvaluationPage.expectAttendance` select the event through a shared `chooseEvent` helper in `e2e-tests/pages/attendance.page.ts` that re-opens the dropdown via `expect.poll` until the option appears (a Select only puts options in the DOM while open, and the list loads async behind a skeleton). If a login/dropdown race still fails, EXTEND those polls (longer timeout, better trigger) rather than adding a one-shot click, and do not re-derive the backend curl unless the poll times out on a genuinely empty list. Re-read the failing spec's sign-in step and the page object, and fix the harness (`e2e-tests/support/**`, `e2e-tests/pages/**`) if it is genuinely broken; otherwise report `test`. Do NOT edit backend publishing code that your direct curl just proved correct.
3. Only if the event is genuinely MISSING from the direct curl: if the Arcus app's `/api/apex/events` returns 404/500 (check its dev-server console) or your curl 404s, the app's `APEX_API_BASE_URL` (gitignored `.env`, which you cannot open or edit) points at the wrong host/version — an operator fix: set `kind` to `environment` and say it must be the local backend `http://127.0.0.1:3000/api/v2`. If the curl 200s but truly lacks the event, investigate `arcus.service.events()`: it scopes by the officer's `custom:organization_id` claim against the submission's `GSI1PK` (`ORGANIZATION#...`), keeps only status `approved`/`finished`, and keeps only items whose `activity_details.date_of_event` is a bare `YYYY-MM-DD` inside the Manila attendance window (`common/manila.ts eventWindow`). Find which of those filters drops it and fix THAT (product), or report `test` if the fixture built the wrong org/date/status.

Note: `e2e-tests/state/run.json` holds only the fixture plan (tag, people, orgs, papers); it has NO event-date field. The event date flows from `--event-date` into `E2E_EVENT_DATE` and is identical across every phase of one run, so the submissions and the Arcus window always agree. Never claim a date mismatch by reading run.json.

Diagnosing a review-desk action that times out in `e2e-tests/pages/review.page.ts` (Approve/Reject/Return never becomes clickable, or Approve stays `disabled`). These are modal-hydration races, NOT backend bugs, and the page object already guards them — extend the guard, do not touch the backend:
1. The detail modal renders its Return/Reject/Approve footer only once the desk's review queue resolves and the paper is in the "For Review" list (`use-review-dashboard.ts isReadOnly`). Until then the modal is read-only history with no action buttons. `ReviewPage.open()` already waits for the "Return Proposal" footer before returning; if a new action path races this, wait for the actionable footer the same way.
2. OSAAR desks additionally gate Approve behind an event-nature classification: the Approve button carries `title="Select an event classification first"` until Minor/Major is chosen, and the classification PATCH (`handleClassificationChange`) is fire-and-forget (errors caught, not thrown). So never decide with a one-shot `major.isVisible()`+click — read the Approve `title`, wait for the "Major Event" control, click it, and re-click (via `expect.poll`) until the title clears. `ReviewPage.approve()` already does this.
3. Only if the classification PATCH genuinely 4xx/5xxs (check the backend response, not the disabled button) is there a product bug in `/signatories/events/:eventId/submissions/:submissionId/classification`. A disabled Approve with the classification title is a harness-timing symptom.

IMPORTANT: If you edited ANY file (including page objects or support helpers), you MUST use `kind: "product"` with a `commit_message`. Using `test` or `environment` after changing files causes the loop to stop WITHOUT committing your work.

After the verdict file is written, stop.
