# Unused / orphaned API routes

This audit records routes the `mapua-apex-frontend` SPA does not call. The
canonical contract is [`API_ROUTES.md`](../API_ROUTES.md).

The Nest server in `mapua-apex-backend-nest` does **not** implement the
Section A routes. The Laravel server in `mapua-apex-backend` still exposes
them under `/api/v1` until cutover. Do not point `VITE_API_BASE_URL` at Nest
as part of this port.

**How this was determined.** Every route in
[`mapua-apex-backend/routes/api.php`](../mapua-apex-backend/routes/api.php)
was cross-referenced against every `apiClient.{get,post,put,patch,delete}(...)`
call in `mapua-apex-frontend/src`. A route is listed as *orphaned* only when
no SPA call targets it.

---

## A. Dropped from the Nest server

These existed on Laravel and had no SPA caller. Nest does not register them.

| # | Method | Endpoint | Why it was unused |
| :-- | :-- | :-- | :-- |
| 1 | **GET** | `/api/v1/admins/monitor/bottlenecks` | The monitor UI calls `monitor/stats`, `monitor/sessions`, and `monitor/activity`, never `bottlenecks`. |
| 2 | **GET** | `/api/v1/sessions/{sessionId}/validate` | The SPA calls `PATCH .../heartbeat` directly. |
| 3 | **POST** | `/api/v1/admins/monitor/sessions/{id}/revoke` | The monitor page can display a `revoked` status, but no control POSTs a revocation. |
| 4 | **GET** | `/api/v1/admins/announcements/{announcement}` | The announcement list already returns each row. |
| 5 | **POST** | `/api/v1/students/events/{event}/submissions/{submission}/notifications` | The SPA reads the timeline. Approve, return, and deny write the rows. |
| 6 | **PUT** | `/api/v1/students/events/{event}/submissions/{submission}/notifications/{notification}` | No manual timeline edit exists in the SPA. |
| 7 | **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications` | Signatory decisions use approve, return, deny, and classification. |
| 8 | **PUT** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications/{notification}` | No manual timeline edit exists in the SPA. |

`GET /api/v2/students/events/{event}/submissions/{submission}/notifications`
remains. Admin submission detail still returns the timeline inline.

---

## B. Kept, and not called by the SPA

These stay on the Nest server under `/api/v2` (health `GET /up` stays at the
root). The Arcus companion apps are outside this repo and still call
`/api/v1/arcus/...` until they are updated.

| Method | Endpoint | Real consumer |
| :-- | :-- | :-- |
| **GET** | `/api/v2/ping` | Health probes. Body `{ "ok": true }`. |
| **GET** | `/up` | Infra health checks. Body `{ "status": "ok" }`. |
| **GET** | `/api/v2/arcus/events` | Arcus apps, `X-Arcus-Service-Token`. |
| **GET** | `/api/v2/arcus/students/{studentId}/events` | Arcus Evaluation, filtered by the student's check-ins. |
| **GET** | `/api/v2/arcus/events/{eventId}/post-eval` | Arcus Evaluation officer view. No `data` wrapper. |

A submission reaches `finished` only when an admin approves its post-evaluation.
The retired Arcus finish route stays retired.
