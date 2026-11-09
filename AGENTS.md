# Project Agent Guidelines

These rules apply across the entire repository (both `mapua-apex-frontend` and `mapua-apex-backend`). Each sub-project also has its own `AGENTS.md` with system-specific rules — read and follow the relevant sub-project file in addition to this one.

## Cross-System Changes

- This repository spans two independent systems: a frontend and a backend. When a change you are making in one system requires a corresponding change in the other (for example, an API route/contract change driven by a UI need, or a UI change driven by a backend response change), **stop and consult the user before modifying the second system.**
- Do not assume it is okay to edit the other system just to make your current change work. Surface the required cross-system edit, describe its scope, and wait for approval before touching files outside the system you were asked to work in.

## Reuse Before Rebuilding

- **Check for an existing implementation first.** Before writing a feature, always search the codebase for anything already implementing it — even partially. Look for existing routes, controllers, components, hooks, helpers, data-model fields, and backend endpoints that cover (or nearly cover) the requested behavior.
- **Partial implementations count.** If a partial implementation exists, surface it, describe what it already does and what it is missing, and extend or wire it up rather than starting a fresh full implementation. Do not silently duplicate working code.

## Todo List

- **A finished task that matches `todo.md` must be recorded there in the same change.** After you complete work, check `docs/todo.md`. If an item is what you just finished, update it before you stop.
- Strike through the heading (`## ~~N. Title~~`) and set **Status** to **Closed**, with one line on what was done. Leave the original goal and notes in place.
- If the work only finishes part of an item, leave the heading as it is. Update **Status** to say what is done and what is still open.
- Do not add, renumber, or close items the current task did not accomplish.

## Documentation Sync

- **API routes edited → update the API contract docs.** Whenever you change an API route, controller, request/response shape, status code, or backend data model, update both `docs/routes/API_ROUTES.md` and `docs/DynamoDB Schema.txt` in the same change. Do not leave them describing the pre-change behavior.
- **Major change → verify the `docs/` files first, then fix if inaccurate.** After a significant change, check the reference documents under `docs/` (e.g. `docs/erd/objects.md`, `docs/erd/access-patterns.md`, `docs/erd/erd.mmd` and its generated `mapua-apex-data-model.pdf`) against the current code and data model. If they are still accurate, leave them. If they are inaccurate, update them to match reality (and rebuild the PDF via `docs/erd/build_pdf.py` when the ERD changed).

## E2E Suite

- **A feature added or changed must update `e2e-tests` in the same change.** When you add a feature or change behavior a user can see, extend the Playwright spec and page object for that screen under `e2e-tests/tests/` and `e2e-tests/pages/`. The projects run in order: `auth`, `setup`, `cdm`, `submissions`, `reviews`, `arcus`, `postevals`, `reservation-changes`. Assert the visible result (status badge, tracker desk, alert, disabled button). Specs may record ids from responses the page already sends. They do not create or approve through the API.
- If no current project owns the behavior, add a spec, a project in `e2e-tests/playwright.config.ts` that depends on the projects it needs, and a `--phase` choice in `e2e-tests/run_e2e.py`.
- Record every DynamoDB item the new steps create on the run manifest, the same way `e2e-tests/support/manifest.ts` records ids from the page response, so cleanup still deletes them.
- **Run the suite once the feature's own tests pass.** Finish the unit and other tests that belong to the feature first. When those pass, run `python run_e2e.py` from `e2e-tests/` as the final integration test. The feature is not finished while that run is failing: read the Playwright list output and `e2e-tests/reports/<tag>/`, fix the feature or the suite, and run it again.
- A refactor that does not change observable behavior does not need a suite edit or a suite run.

## Cloud Scripts (boto3)

- When asked to write a script that utilizes cloud resources through **boto3**, always place the script in the `mapua-apex-frontend/scripts/` folder.
- End the response with both: (1) the exact command line to execute the script (e.g. `python scripts/<name>.py --flags`), and (2) a short TL;DR of what the script does.
