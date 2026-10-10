# Unused / orphaned API routes

This is an **informational** audit of backend routes that the `mapua-apex-frontend`
SPA does not call. It complements the canonical contract in the root
[`API_ROUTES.md`](../API_ROUTES.md).

**Scope note.** Per the current work item, these backend routes were **left
untouched** — nothing here has been deleted or changed in `mapua-apex-backend`.
This file only records the findings so a future, backend-scoped change can decide
what to keep, wire up, or remove.

**How this was determined.** Every route in
[`mapua-apex-backend/routes/api.php`](../mapua-apex-backend/routes/api.php)
(plus the framework health route registered in `bootstrap/app.php`) was
cross-referenced against every `apiClient.{get,post,put,patch,delete}(...)` call
in `mapua-apex-frontend/src`. A route is listed as *orphaned* only when no SPA
call targets it. The canonical route list and request/response shapes live in
`API_ROUTES.md`; this file does not redefine them.

---

## A. Orphaned routes (no SPA consumer)

These exist and work, but nothing in the frontend calls them. They are candidates
for either (a) wiring into the UI, or (b) removal in a future backend cleanup.
Left in place for now.

| # | Method | Endpoint | Handler | Why it appears unused |
| :-- | :-- | :-- | :-- | :-- |
| 1 | **GET** | `/api/v1/admins/monitor/bottlenecks` | `LogMonitorController@getBottlenecks` | The monitor UI (`hooks/use-monitor.ts`) calls `monitor/stats`, `monitor/sessions` (list + detail), and `monitor/activity` (list + detail), but never `bottlenecks`. Idle-session surfacing is not wired into the admin monitor pages. |
| 2 | **GET** | `/api/v1/sessions/{sessionId}/validate` | `SessionController@validateSession` | `validateSession` simply delegates to `heartbeat`. The SPA's `hooks/use-session-logger.ts` calls the `PATCH .../heartbeat` route directly, so the separate `GET .../validate` is redundant for the frontend. |
| 3 | **POST** | `/api/v1/admins/monitor/sessions/{id}/revoke` | `LogMonitorController@revokeSession` | `routes/admin/monitor-sessions.tsx` *displays* a `revoked` status, but there is no UI action that POSTs a revocation. The admin "revoke session" control is not implemented in the SPA. |
| 4 | **POST** | `/api/v1/students/events/{event}/submissions/{submission}/notifications` | `Student\NotificationController@store` | The SPA **reads** the student timeline (`GET .../notifications` in `hooks/use-submissions.ts`) but never creates a row manually — timeline entries are written server-side by the approve/return/deny flows. |
| 5 | **PUT** | `/api/v1/students/events/{event}/submissions/{submission}/notifications/{notification}` | `Student\NotificationController@update` | Same as #4 — no manual timeline-row editing exists in the SPA. |
| 6 | **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications` | `Signatory\NotificationController@store` | Signatory decisions go through `.../approve`, `.../return`, `.../deny`, and `.../classification` (all consumed). The standalone notification-create endpoint is not called by the SPA. |
| 7 | **PUT** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications/{notification}` | `Signatory\NotificationController@update` | Same as #6 — no manual timeline-row editing exists in the SPA. |

> Note: the **GET** notification routes are *not* orphaned. `GET
> /api/v1/students/events/{event}/submissions/{submission}/notifications` is
> consumed by `hooks/use-submissions.ts`, and admin submission detail
> (`GET /api/v1/admins/events/{event}/submissions/{submission}`) returns the
> timeline inline. Only the **POST/PUT** notification writers above are unused.

---

## B. Intentionally not consumed by the SPA (keep)

These have **no frontend caller by design** — they serve other systems or infra.
They are **not** dead code and must not be treated as orphaned.

| Method | Endpoint | Real consumer | Notes |
| :-- | :-- | :-- | :-- |
| **GET** | `/api/v1/ping` | External health/liveness probes (`curl`, uptime monitors) | Returns `{ "ok": true }`; throttled with the student limiter. No SPA caller. |
| **GET** | `/api/v1/arcus/events` | arcus companion apps (server-to-server) | Guarded by `arcus.service` (`X-Arcus-Service-Token`). The SPA's `lib/arcus-links.ts` only builds **deep links** to the arcus app UIs; it never calls this route. |
| **POST** | `/api/v1/arcus/events/{event}/submissions/{submission}/finish` | arcus companion apps (server-to-server) | Same shared-secret guard as above. |
| **GET** | `/up` | Container / infra healthchecks | Laravel framework health route registered at the app root in `bootstrap/app.php` (`health: '/up'`), **not** under `/api/v1`. |

---

## C. Recommended follow-up (out of current scope)

Any decision to remove the Section A routes should be a **backend-scoped** change
and, per the repository `AGENTS.md`, must update `API_ROUTES.md` and
`DynamoDB Schema.txt` in the same change. Before deleting, confirm each route is
also unused by any **non-SPA** caller (scripts, arcus apps, external monitors) —
this audit only covered the frontend.
