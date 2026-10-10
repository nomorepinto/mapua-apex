# Frontend routes

Client-side route map for `mapua-apex-frontend`. The single source of truth is the `createBrowserRouter` tree in [`src/router.tsx`](mapua-apex-frontend/src/router.tsx); this document mirrors it. This is the frontend counterpart to [`API_ROUTES.md`](API_ROUTES.md) (backend HTTP contract) — keep the two separate.

## Routing model

- **React Router (data mode).** Built with `createBrowserRouter` in `src/router.tsx` and mounted by `src/main.tsx` under the OIDC `AuthProvider`.
- **Role sections.** Each signed-in role owns a top-level prefix (`/students`, `/cdm-reviewer`, `/dean`, `/org-adviser`, `/signatories`, `/osaar`, `/admin`) wrapped by a layout in `src/routes/layouts/`.
- **Lazy pages.** Every leaf page is code-split via a `lazy` async `import()` returning `{ Component }`, with `HydrateFallback: RouteFallback`. Add a co-located `action` (via `Promise.all`) only when the route mutates (e.g. the SAAF submit route).
- **Nested shells.** Sections that group sub-pages use a parent route with children: `PassThroughLayout` (renders `<Outlet />` only, e.g. `/students/submissions`, `/osaar/review`, `/admin/monitor`) or a dedicated shell component (e.g. `OsaarSetupLayout` for `/osaar/setup`).
- **Index + wildcard.** Each section's `index: true` redirects to its landing page and a `path: "*"` catch-all redirects back to it. The global `path: "*"` renders `NotFoundPage`.

## Auth & role gating

Sign-in is Amazon Cognito (OIDC). Unauthenticated hits on a guarded layout redirect to `/`. `AuthGuard` (`src/components/auth/AuthGuard.tsx`) checks `cognito:groups` (case-insensitive) against the layout's `allowedGroups`; no match → **"Access Denied"** panel (not a `403` page). `RoleRedirect` (`src/components/auth/RoleRedirect.tsx`) sends a just-signed-in user (rendered from the landing page) to their section landing.

| Layout | Allowed Cognito groups | Landing page |
| :---- | :---- | :---- |
| `StudentsLayout` | `admin`, `org_adviser`, `org_submitter`, `student` | `/students/dashboard` |
| `CdmReviewerLayout` | `admin`, `cdm_reviewer`, `cdm` | `/cdm-reviewer/dashboard` |
| `DeanLayout` | `admin`, `dean` | `/dean/dashboard` |
| `OrgAdviserLayout` | `admin`, `org_adviser` | `/org-adviser/dashboard` |
| `OsaarLayout` | `admin`, `osaar` | `/osaar/dashboard` |
| `AdminLayout` | `admin` | `/admin/sessions` |

**Post-login hand-off** (`RoleRedirect`, first match wins): `admin` → `/admin/sessions`; `osaar` → `/osaar/dashboard`; `cdm_reviewer` → `/cdm-reviewer/dashboard`; `dean` → `/dean/dashboard`; `org_adviser` → `/org-adviser/dashboard`; `org_submitter` → `/students/dashboard`; unknown group → `/students/dashboard`.

**Log monitor gating.** Two page groups are wrapped in an extra `AuthGuard` at the route level (constants in `src/constants/auth.ts`):

- `SESSION_LOG_GROUPS = ["admin"]` — gates `/admin/sessions`.
- `ACTIVITY_LOG_GROUPS = ["admin", "osaar", "cdm_reviewer", "cdm"]` — gates the Activity Log pages reused across sections (`/admin/activities`, `/osaar/activities`, `/cdm-reviewer/activities`).

---

## Public

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/` | `LandingPage` | `src/routes/landing.tsx` | Marketing landing + sign-in. If already authenticated, renders `RoleRedirect` instead. |

---

## Student routes (`/students`)

Layout: `StudentsLayout` (`src/routes/layouts/students-layout.tsx`). Sidebar: Dashboard, New proposal.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/students` | redirect | — | → `dashboard` |
| `/students/dashboard` | `OrgDashboard` | `src/routes/students/dashboard.tsx` | Org home: submissions, deadlines, reminders. |
| `/students/submissions` | `SubmissionsStart` | `src/routes/students/submissions.tsx` | Index of the `submissions` branch (`PassThroughLayout`). |
| `/students/submissions/saaf` | `Submission` + `action` | `src/routes/students/saaf.tsx`, `saaf.action.ts` | The SAAF multi-step wizard. Has a route `action` that POSTs the submission. |
| `/students/about` | `About` | `src/routes/about.tsx` | Shared "About APEX" page. |
| `/students/*` | redirect | — | → `dashboard` |

---

## CDM Reviewer routes (`/cdm-reviewer`)

Layout: `CdmReviewerLayout` (`src/routes/layouts/cdm-reviewer-layout.tsx`). Sidebar: Dashboard, Reservables, (Activity Log when in `ACTIVITY_LOG_GROUPS`).

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/cdm-reviewer` | redirect | — | → `dashboard` |
| `/cdm-reviewer/dashboard` | `CdmReviewerDashboard` | `src/routes/cdm-reviewer/dashboard.tsx` | CDM review home. |
| `/cdm-reviewer/reservables` | `AdminReservablesPage` | `src/routes/cdm-reviewer/reservables.tsx` | Add / View / Reserve reservables (segmented control). |
| `/cdm-reviewer/activities` | `AdminMonitorActivitiesPage` | `src/routes/admin/monitor-activities.tsx` | Reused admin page, wrapped in `AuthGuard` `ACTIVITY_LOG_GROUPS`. |
| `/cdm-reviewer/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/cdm-reviewer/*` | redirect | — | → `dashboard` |

---

## Dean routes (`/dean`)

Layout: `DeanLayout` (`src/routes/layouts/dean-layout.tsx`). Sidebar: Dashboard.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/dean` | redirect | — | → `dashboard` |
| `/dean/dashboard` | `DeanDashboard` | `src/routes/dean/dashboard.tsx` | Review queue + submission history. |
| `/dean/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/dean/*` | redirect | — | → `dashboard` |

---

## Org Adviser routes (`/org-adviser`)

Layout: `OrgAdviserLayout` (`src/routes/layouts/org-adviser-layout.tsx`). Sidebar: Dashboard.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/org-adviser` | redirect | — | → `dashboard` |
| `/org-adviser/dashboard` | `OrgAdviserDashboard` | `src/routes/org-adviser/dashboard.tsx` | Adviser review queue. |
| `/org-adviser/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/org-adviser/*` | redirect | — | → `dashboard` |

---

## Signatory routes (`/signatories`)

Reuses `DeanLayout` + `DeanDashboard` (same review-queue shell as a Dean). Layout: `src/routes/layouts/dean-layout.tsx`.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/signatories` | redirect | — | → `dashboard` |
| `/signatories/dashboard` | `DeanDashboard` | `src/routes/dean/dashboard.tsx` | Shared component with the Dean section. |
| `/signatories/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/signatories/*` | redirect | — | → `dashboard` |

---

## OSAAR routes (`/osaar`)

Layout: `OsaarLayout` (`src/routes/layouts/osaar-layout.tsx`). Sidebar: Dashboard, Setup, Review, Activity Log.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/osaar` | redirect | — | → `dashboard` |
| `/osaar/dashboard` | `AdminOsaPanel` | `src/routes/osaar/dashboard.tsx` | OSAAR home: calendar, submissions queue, announcements. |
| `/osaar/setup` | `OsaarSetupLayout` | `src/routes/osaar/setup.tsx` | Shell with a segmented tab bar over the three master-data sub-pages. |
| `/osaar/setup/organizations` | `AdminOrganizationsPage` | `src/routes/osaar/organizations.tsx` | Manage orgs + their adviser/dean desks. |
| `/osaar/setup/signatories` | `AdminSignatoriesPage` | `src/routes/osaar/signatories.tsx` | Manage signatory people. |
| `/osaar/setup/campuses` | `AdminCampusPage` | `src/routes/osaar/campus.tsx` | Manage campuses. |
| `/osaar/setup` (index) | redirect | — | → `organizations`. |
| `/osaar/review` | `PassThroughLayout` | — | Index → `dashboard`. |
| `/osaar/review/dashboard` | `AdminReviewDashboard` | `src/routes/osaar/review-dashboard.tsx` | Reviewer queue. |
| `/osaar/activities` | `AdminMonitorActivitiesPage` | `src/routes/admin/monitor-activities.tsx` | Reused admin page, wrapped in `AuthGuard` `ACTIVITY_LOG_GROUPS`. |
| `/osaar/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/osaar/*` | redirect | — | → `dashboard` |

---

## Admin routes (`/admin`)

Layout: `AdminLayout` (`src/routes/layouts/admin-layout.tsx`). Sidebar: Session Log (when in `SESSION_LOG_GROUPS`), Activity Log (when in `ACTIVITY_LOG_GROUPS`). Home logo links to `/admin/sessions`. Admin is effectively the super-admin monitoring panel.

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `/admin` | redirect | — | → `/admin/sessions` |
| `/admin/sessions` | `AdminMonitorSessionsPage` | `src/routes/admin/monitor-sessions.tsx` | Session log monitor, wrapped in `AuthGuard` `SESSION_LOG_GROUPS`. |
| `/admin/activities` | `AdminMonitorActivitiesPage` | `src/routes/admin/monitor-activities.tsx` | Activity log monitor, wrapped in `AuthGuard` `ACTIVITY_LOG_GROUPS`. |
| `/admin/monitor` | `PassThroughLayout` | `src/routes/admin/monitor.tsx` | Legacy alias branch — every child redirects (see below). |
| `/admin/monitor` (index) | redirect | — | → `/admin/sessions` |
| `/admin/monitor/overview` | redirect | — | → `/admin/sessions` |
| `/admin/monitor/sessions` | redirect | — | → `/admin/sessions` |
| `/admin/monitor/activities` | redirect | — | → `/admin/activities` |
| `/admin/about` | `About` | `src/routes/about.tsx` | Shared. |
| `/admin/*` | redirect | — | → `/admin/sessions` |

---

## Fallback

| Path | Component | Source file | Notes |
| :---- | :---- | :---- | :---- |
| `*` (any unmatched) | `NotFoundPage` | `src/components/layout/error-boundary.tsx` | Global not-found. Every section also mounts `RootErrorBoundary`. |

---

## Conventions when editing routes

Keep this file in sync with `src/router.tsx` — see the "Frontend Route Docs" rule in [`mapua-apex-frontend/AGENTS.md`](mapua-apex-frontend/AGENTS.md). Filenames are kebab-case under the matching `src/routes/<section>/` folder; layouts live in `src/routes/layouts/`; page-name labels for session tracking are mapped separately in `src/lib/page-names.ts`.
