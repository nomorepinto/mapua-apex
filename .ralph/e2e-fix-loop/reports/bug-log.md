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

