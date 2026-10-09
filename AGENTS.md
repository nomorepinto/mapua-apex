# Project Agent Guidelines

These rules apply across the entire repository (both `mapua-apex-frontend` and `mapua-apex-backend`). Each sub-project also has its own `AGENTS.md` with system-specific rules — read and follow the relevant sub-project file in addition to this one.

## Cross-System Changes

- This repository spans two independent systems: a frontend and a backend. When a change you are making in one system requires a corresponding change in the other (for example, an API route/contract change driven by a UI need, or a UI change driven by a backend response change), **stop and consult the user before modifying the second system.**
- Do not assume it is okay to edit the other system just to make your current change work. Surface the required cross-system edit, describe its scope, and wait for approval before touching files outside the system you were asked to work in.

## Reuse Before Rebuilding

- **Check for an existing implementation first.** Before writing a feature, always search the codebase for anything already implementing it — even partially. Look for existing routes, controllers, components, hooks, helpers, data-model fields, and backend endpoints that cover (or nearly cover) the requested behavior.
- **Partial implementations count.** If a partial implementation exists, surface it, describe what it already does and what it is missing, and extend or wire it up rather than starting a fresh full implementation. Do not silently duplicate working code.

## Documentation Sync

- **API routes edited → update the API contract docs.** Whenever you change an API route, controller, request/response shape, status code, or backend data model, update both `API_ROUTES.md` and `DynamoDB Schema.txt` (at the repository root) in the same change. Do not leave them describing the pre-change behavior.
- **Major change → verify the `docs/` files first, then fix if inaccurate.** After a significant change, check the reference documents under `docs/` (e.g. `docs/erd/objects.md`, `docs/erd/access-patterns.md`, `docs/erd/erd.mmd` and its generated `mapua-apex-data-model.pdf`) against the current code and data model. If they are still accurate, leave them. If they are inaccurate, update them to match reality (and rebuild the PDF via `docs/erd/build_pdf.py` when the ERD changed).

## Cloud Scripts (boto3)

- When asked to write a script that utilizes cloud resources through **boto3**, always place the script in the `mapua-apex-frontend/scripts/` folder.
- End the response with both: (1) the exact command line to execute the script (e.g. `python scripts/<name>.py --flags`), and (2) a short TL;DR of what the script does.
