# Deferred Work — TODO

Items intentionally deferred out of the post-evaluation overhaul. They are
tracked here so they are not lost, but are **not** part of the current change.

## 1. Merge the three apps' data sources into one unified schema

**Status:** Deferred — too risky right now.

**Goal:** Have the two arcus companion apps (`arcus-attendance-system`,
`arcus-evaluation-system`) read mapua-apex's authoritative
`ORGANIZATION#` / `EVENT#` / `MEMBER#` items instead of each app maintaining
its own parallel copies inside the shared table.

**Context:** All three apps already write to ONE physical DynamoDB table
(`mapua-apex`, region `ap-southeast-1`, same IAM credentials). They coexist
today by using non-overlapping key prefixes and sparse GSIs, but their schemas
were designed independently.

**Known blockers (why this is risky):**

- **Divergent GSI semantics in the same table.** The apps assign different
  meanings to the same physical indexes:
  - arcus-attendance uses `GSI1PK = "EVENT"` (list all events) and
    `GSI3PK = "ORGANIZATION"` (events by org).
  - mapua-apex uses `GSI1PK = ORGANIZATION#uuid` (org-scoped discovery, with
    `GSI1SK` prefixes `SUBMISSION#…`, `POSTEVAL#…`, and a bare timestamp for
    event parents) and `GSI2PK = SIGNATORY#uuid` (signatory inbox).
  - Unifying these requires reconciling index meanings without breaking live
    queries in any of the three apps.
- **Duplicate rosters.** Org / event / member records exist in parallel shapes
  (e.g. arcus `ORGANIZATION#{id}` roster with CSV import vs. apex
  `ORGANIZATION#{id}` parent item; arcus-attendance local `EVENT#{uuid}` vs.
  apex `EVENT#{uuid}`). A merge needs a single source of truth plus a data
  migration/backfill.
- **Cross-app deployment coupling.** Any schema change must be rolled out to
  three independently deployed apps without downtime.

**If/when pursued:** design a migration that (a) picks apex as the authoritative
source, (b) backfills arcus reads onto apex items, (c) re-maps or adds GSIs so
both semantics can coexist during transition, and (d) removes the parallel
arcus writes only after all readers are switched.

## 2. EventBridge scheduler → `cancelled` status

**Status:** Deferred — not wired in the current change.

**Goal:** When an event's 3-day post-evaluation window lapses with **no**
submitted post-eval, automatically set the linked SUBMISSION
`status = cancelled` (+ `cancelled_at`).

**Notes:**
- Add `cancelled` to the submission status enum at that time (it is reserved in
  the docs now but not produced by any code path yet).
- Likely implemented as an EventBridge Scheduler rule (per approved event,
  firing at `date_of_event` end-of-day + `post_evaluation_window_days`) that
  checks for an existing `POSTEVAL#` child under the event partition and, if
  absent, patches the submission to `cancelled`.
- The window length is `services.arcus.post_evaluation_window_days` (default 3);
  the stateless window logic lives in `app/Support/Arcus/EventWindow.php`.
