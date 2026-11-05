# E2E report CBoJ

Cleanup deleted 0 items before the run and 431 after.
Leftover matches: 0.

- [PASS] preflight — event date 2026-11-05
- [FAIL] playwright — npx playwright test exited 1; failed: postevals.spec.ts:33 @ OSAAR approves P2 and the student badge stays pending @ TimeoutError: page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response" @ ui.ts:38
- [GAP] finished paper badge — The API stores finished. The student badge maps that status to Pending.
- [PASS] cleanup after — deleted 431, left 0
