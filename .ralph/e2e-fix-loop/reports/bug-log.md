# E2E bug log


## Iteration 1 - submit P1
- HTTP: 500
- Detail: POST /students/submissions -> 500: Server Error
- Verdict: product
- Summary: POST /students/submissions returned 500 because DynamoDB rejected class-validator form objects; the writer now stores those fields as plain maps.
- Commit: mapua-apex 68490e8 fixed submission save of validated forms


## Iteration 2
Same failure as the previous run. Loop stopped.
- submit P1: POST /students/submissions -> 500: Server Error


## Iteration 1
Suite failed with no product fail step (exit 1). Loop stopped.


## Iteration 1
Suite failed with no product fail step (exit 1). Loop stopped.
Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-uCDW


Suite passed on iteration 1 (2026-11-02).
Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-qIyo


## Iteration 1 - playwright
- HTTP: 
- Detail: npx playwright test exited 1
- Verdict: environment
- Summary: Cognito rejected the Arcus attendance callback with redirect_mismatch: the apex-attendance-system client only registers http://localhost:3000/api/auth/callback while the app and suite run on 3001, so add http://localhost:3001/api/auth/callback (and logout http://localhost:3001/) in the user pool.
- Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-JfDq
- Note: agent hit qodercli max-turns (40) after writing verdict.json, so the loop exited via throw before logging this entry. No product code change; fix belongs in the Cognito user pool app client settings.


## Iteration 1 - playwright
- HTTP: 
- Detail: npx playwright test exited 1
- Verdict: (no verdict.json written)
- Summary: after the Cognito :3001 callback was registered, the arcus hostedLogin moved from username-locator timeout to password-locator timeout because Cognito's managed login reveals the password only after a Next button click. The fix lives in e2e-tests/support/auth.ts, which is a blocked path for the loop, so the agent exhausted 40 turns without writing a verdict. Committed a manual hostedLogin update (email -> optional Next -> password) and switched the loop to a non-today weekday event date so the Cognito-dependent arcus and post-eval phases skip by design.
- Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-fzDZ
- Note: agent hit qodercli max-turns (40) and threw at line 268 before the log write, so this entry is manual.


Suite passed on iteration 1 (2026-11-06).
Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-ULfO


## Iteration 1 - playwright
- HTTP: 
- Detail: npx playwright test exited 1
- Verdict: test
- Summary: Arcus added a deliberate non-dismissable 'Before you continue' instructions dialog on the registration page; its focus trap blocks the form, so the AttendancePage.register page object now acknowledges it before filling the fields. No application change.
- Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-AQDF

## Iteration 1 - playwright
- HTTP: 
- Detail: npx playwright test exited 1
- Verdict: product
- Summary: Arcus page objects navigated with baseURL-relative paths, so the A2S pages loaded on the APEX frontend origin (or on 127.0.0.1, where the host-only localhost session cookies are not sent) and showed the APEX landing page; they now open absolute URLs built from the Arcus bases, with env normalizing 127.0.0.1 to localhost to match APP_BASE_URL.
- Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\01-DqKb
- Commit: mapua-apex de7a203 fixed arcus pages loading on the apex origin


## Iteration 2
Same failure as the previous run. Loop stopped.
- playwright: npx playwright test exited 1
Saved: F:\CareerStuff\myPrograms\Project Apex\mapua-apex\.ralph\e2e-fix-loop\reports\02-VHsq

