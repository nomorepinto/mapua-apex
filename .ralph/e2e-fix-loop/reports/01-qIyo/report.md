# E2E report qIyo

Cleanup deleted 0 items before the run and 261 after.
Leftover matches: 0.

- [PASS] preflight — event date 2026-11-02
- [PASS] setup campus — 9b29a0ee-cdfd-4f09-a2ba-45d23ebfdf3a
- [PASS] setup signatories — cdm reused
- [PASS] setup organizations — three organizations
- [PASS] setup approval stages — osaar1 then osaar2
- [PASS] setup account links — desk and organization accounts linked
- [PASS] cdm reservables and holds
- [PASS] submit P1 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P2 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db -> a638aec7-7d9d-4cd9-81db-e841189d6b80
- [PASS] submit P3 — 06913718-9667-49a9-8067-b4b490c67049 -> f6ac2aa3-121c-4526-a163-068553ade4c6 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P4 — 06913718-9667-49a9-8067-b4b490c67049 -> f6ac2aa3-121c-4526-a163-068553ade4c6 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db -> a638aec7-7d9d-4cd9-81db-e841189d6b80
- [PASS] submit P5 — 06913718-9667-49a9-8067-b4b490c67049 -> 7a3442be-136d-4aea-88b0-824f320ce087 -> f6ac2aa3-121c-4526-a163-068553ade4c6 -> 1c12451c-da09-4a8e-88d0-5adfede0cc99 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P6 — bb3a3e38-54ca-4a6d-bfaa-c93eb2d5f231 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db -> a638aec7-7d9d-4cd9-81db-e841189d6b80
- [PASS] submit P7 — bb3a3e38-54ca-4a6d-bfaa-c93eb2d5f231 -> 06913718-9667-49a9-8067-b4b490c67049 -> f6ac2aa3-121c-4526-a163-068553ade4c6 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P9 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P10 — 06913718-9667-49a9-8067-b4b490c67049 -> f6ac2aa3-121c-4526-a163-068553ade4c6 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P11 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P12 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db
- [PASS] submit P13 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db -> a638aec7-7d9d-4cd9-81db-e841189d6b80
- [PASS] submit P14 — 06913718-9667-49a9-8067-b4b490c67049 -> a9ebf3f8-2102-4d8e-b692-7e2313ddd0ba -> eb2f7cce-6759-43cb-9866-74ccf594b9db -> a638aec7-7d9d-4cd9-81db-e841189d6b80
- [PASS] submit P8 equipment only HTTP 422 — 422 as expected
- [PASS] admin edit P1 — lineup unchanged
- [PASS] approve P1
- [PASS] approve P2
- [PASS] approve P3
- [PASS] approve P6
- [PASS] approve P7
- [PASS] return and approve P5 — resumed at each desk
- [PASS] return and approve P4 — resumed at each desk
- [PASS] deny P9 at adv1 HTTP 422 — edit after deny is 422
- [PASS] deny P10 at dean1 HTTP 422 — edit after deny is 422
- [PASS] deny P11 at osaar1 HTTP 422 — edit after deny is 422
- [PASS] deny P12 at osaar2 HTTP 422 — edit after deny is 422
- [PASS] deny P13 at cdm1 HTTP 422 — edit after deny is 422
- [PASS] resubmit extra-curricular restarts at adviser
- [GAP] resubmit at OSAAR with a new collaborator — resumed at OSAAR, so the new adviser was skipped
- [PASS] final approval blocked by CDM hold HTTP 409 — 409 at CDM
- [SKIP] arcus — event date is not today
- [SKIP] postevals — event date is not today
- [PASS] reservation changes on P4 — reschedule, deny, cancel
- [GAP] finished paper badge — The API stores finished. The student badge maps that status to Pending.
- [GAP] student reservation change entry — The suite files reservation changes through the API. No page calls that dialog.
- [GAP] stale reservation draft — Choosing no on the start page does not clear reservation picks already stored in the draft.
- [PASS] cleanup after — deleted 261, left 0
