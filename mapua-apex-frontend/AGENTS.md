# Frontend Agent Guidelines

These rules apply to `mapua-apex-frontend`. Also follow the root `AGENTS.md` (cross-system changes) and the backend `AGENTS.md` when a change touches the backend.

## Componentization & Layout Conventions

- **Separate new additions into components.** Do not inline new UI blocks directly into an existing page. Extract them into their own component (under the existing `src/components` structure) and compose them into the page.
- **Follow the page-layout conventions already used in this project.** Before creating or editing a page/component, study sibling pages and components and match their established structure, layout patterns, naming, and styling. Reuse existing components where they fit rather than writing a new one from scratch.
- Consistency with the surrounding code takes precedence over introducing a fresh pattern.

## Routing & New Pages

- **When adding a new page, strictly follow the conventions set in `src/routes` and wired in `src/router.tsx`.** Study the existing route tree before creating files or editing routes; match the patterns already used rather than inventing a new one:
  - **Place the page file under its appropriate parent route folder.** Pages that belong to a section live in the matching subfolder of `src/routes` (e.g. admin pages in `src/routes/admin/`, student pages in `src/routes/students/`, signatory pages in `src/routes/signatories/`). Use kebab-case filenames and export a named page component.
  - **Layouts belong in `src/routes/layouts/`.** Shared shell/wrapper layouts (e.g. `admin-layout.tsx`, `students-layout.tsx`) live under `src/routes/layouts`; never inline a layout into a page file or drop it elsewhere in `src/routes`. Reuse an existing layout as a route's `Component` before creating a new one.
  - **Register the page in the route tree** in `src/router.tsx` as a `child` of its parent layout route, matching the sibling style: a `path`, `HydrateFallback: RouteFallback`, and a `lazy` async import that returns `{ Component }`. Add a co-located `action` (via `Promise.all`) only when the route needs one.
  - **Nest sub-sections the same way** the existing `submissions` branch nests `saaf` (parent uses a `PassThroughLayout` wrapper with `children`).
- Consistency with the existing route conventions takes precedence over introducing a fresh routing pattern.

## UI Components

- **Use coss ui components.** For interactive UI (selects, dropdowns, dialogs, menus, inputs, toggles, etc.), use the coss ui primitives vendored in `src/components/ui` (the `@coss` registry, built on Base UI). Prefer these existing exports over hand-rolled markup or another component library, and follow each primitive's documented composition/trigger hierarchy.
- **Light mode only.** This app ships a single light theme. Do not add dark-mode variants, `dark:` styling, or theme toggles; use coss components in their light-mode presentation.

## Data Fetching & Caching

- **Follow the existing query-key convention and reuse the established keys**; when you mutate, invalidate the correct key(s) (including the shared/global keys that other panels read) so lists don't go stale. Copy the invalidation pattern from a sibling mutation hook.

## State & Auth

- **Global client state uses Zustand stores in `src/stores`.** Don't introduce a second state library; extend an existing store or add one matching the current persist pattern.
- **Role gating uses the Cognito group convention already in place** (`src/auth-config.ts`, `AuthGuard`/`RoleRedirect`, `SubmissionAccess`). Reuse those helpers for "who can see this" rather than hand-writing group checks in components.

## Reuse & Typing

- **Reuse before you build.** Before writing a new component/hook/util, check `src/components`, `src/hooks`, and `src/lib` — a shared primitive likely exists.
- **Type new code properly** — no `any`, no `@ts-ignore`/`@ts-nocheck` without a comment justifying it; prefer types exported from the API/hook layer.
