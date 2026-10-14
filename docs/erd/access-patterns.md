# mapua-apex — DynamoDB Access Patterns

DynamoDB is modeled around **access patterns**, not normalized relations: every
query is designed first, then the partition key (PK), sort key (SK), and global
secondary indexes (GSI) are chosen to serve it. All patterns hit a **single
table**. There are no joins — related IDs are copied onto items at write time.

Index summary:

| Index | Key | On | Purpose |
|---|---|---|---|
| Base table | `PK` / `SK` | all items | Primary access |
| GSI1 | `GSI1PK` / `GSI1SK` | EVENT, SUBMISSION, POSTEVAL | Org event walk (deadlines), student & admin submission lists, org/OSAAR post-eval list |
| GSI2 | `GSI2PK` / `GSI2SK` | SUBMISSION | Sparse signatory inbox (`pending` / `returned`) |
| GSI4 | `GSI4PK` / `GSI4SK` | SIGNATORY | Role directory (`ROLE#...`) |
| GSI5 | `GSI5PK` / `GSI5SK` | BOOKING | Org-scoped booking list (submission-sourced holds only; operator-provisioned) |
| GSI6 | `GSI6PK` / `GSI6SK` | RESERVATION_CHANGE | CDM per-campus reservation-change queue (`status#requested_at`; operator-provisioned) |

---

## Core access patterns

| # | Access pattern | Operation | Key condition | Index |
|---|---|---|---|---|
| 1 | Org event walk (deadlines list) | Query | `GSI1PK = ORGANIZATION#id` (first 25 EVENT items, oldest first) | GSI1 |
| 2 | Event children (its deadlines) | Query | `PK = EVENT#id`, `SK` begins `DEADLINE#` | Base |
| 3 | Student's own submissions | Query | `GSI1PK = ORGANIZATION#id`, `GSI1SK` begins `SUBMISSION#` (all papers, paginated) | GSI1 |
| 4 | Collaboration submissions (dependent view) | Query | `PK = ORGANIZATION#<dep>`, `SK` begins `COLLAB#`, then resolve each pointer to its master SUBMISSION | Base |
| 5 | Single submission detail | GetItem | `PK = EVENT#id`, `SK = SUBMISSION#id` | Base |
| 6 | Submission timeline / audit | Query | `PK = SUBMISSION#id`, `SK` begins `NOTIFICATION#` | Base |
| 7 | Signatory inbox (desk queue) | Query | `GSI2PK = SIGNATORY#id`, `GSI2SK` by time (sparse) | GSI2 |
| 8 | Signatory directory by role | Query | `GSI4PK = ROLE#...`, `GSI4SK` begins `SIGNATORY#` | GSI4 |
| 9 | Current signatory profile (`/signatories/me`) | GetItem | `PK = SIGNATORY#id`, `SK = SIGNATORY#id` | Base |
| 10 | Admin: all submissions | Query | per org `GSI1PK = ORGANIZATION#id`, `GSI1SK` begins `SUBMISSION#` | GSI1 |
| 11 | Student org record (`/students/organization`) | GetItem | `PK = ORGANIZATION#id`, `SK = ORGANIZATION#id` | Base |
| 12 | Org directory (`/students/organizations`) | Query | org list → `{ organization_id, name }` | Base |
| 13 | Announcement list | Query | `PK = ANNOUNCEMENT`, `SK` desc (newest first) | Base |
| 14 | Announcement show / edit / delete | GetItem / PutItem / DeleteItem | `PK = ANNOUNCEMENT`, `SK = timestamp` | Base |
| 15 | Write submission (+ collab pointers) | PutItem | `PK = EVENT#id`, `SK = SUBMISSION#id`; maintain one COLLAB pointer per dependent | Base |
| 16 | Approve / return / deny | UpdateItem | advance `current_signatory` / `GSI2PK` from stored `signatory_sequence`; write NOTIFICATION | Base |
| 17 | Admin: delete organization (guarded) | Query → DeleteItem | block (**409**) if `GSI1PK = ORGANIZATION#id` has events/submissions or base `PK = ORGANIZATION#id`, `SK` begins `COLLAB#`; else DeleteItem `PK = SK = ORGANIZATION#id` | GSI1 + Base |
| 18 | Admin: delete signatory (guarded) | Scan/Query → DeleteItem | block (**409**) if any `ORGANIZATION.signatories` desk holds the id or `GSI2PK = SIGNATORY#id` (open inbox); else DeleteItem `PK = SK = SIGNATORY#id` | GSI2 + Base |
| 19 | Campus list (osaar `/campus`, SAAF venue dropdown) | Scan | `PK` begins `CAMPUS#` AND `PK = SK` | Base |
| 20 | Reservables under a campus | Query | `PK = CAMPUS#id`, `SK` begins `RESERVABLE#` | Base |
| 21 | Reservable availability (template + per-date free/booked slots) | Query | `PK = RESERVABLE#id`, `SK` begins `BOOKING#`; overlay bookings on the weekly template across the window | Base |
| 22 | CDM View/Reserve calendar (raw bookings, both sources) | Query | `PK = RESERVABLE#id`, `SK` begins `BOOKING#` (filtered to dates in window) | Base |
| 23 | Create booking (submission hold or CDM manual) | Query → PutItem | validate selections vs template + existing bookings (**409** on conflict) and, on submission, expected headcount vs each room's `min/max_participants` (**422** out of range), then PutItem `PK = RESERVABLE#id`, `SK = BOOKING#id` | Base |
| 24 | Release holds on deny / return / re-edit / cancel-resolution | DeleteItem | delete each `booking_refs[]` `{pk, sk}` (submission holds) | Base |
| 25 | Delete a manual booking (CDM) | GetItem → DeleteItem | **409** if `source` is `submission`; else DeleteItem `PK = RESERVABLE#id`, `SK = BOOKING#id` | Base |
| 26 | Admin: delete campus / reservable (guarded) | Query → DeleteItem | block (**409**) if a campus owns any RESERVABLE, or a reservable owns any BOOKING; else DeleteItem | Base |
| 27 | Create / edit reservable (CDM Add/Edit) | GetItem → PutItem | for a `room` flagged `is_classroom`, GetItem the owning CAMPUS and enforce it defines a classroom format (**422** on `is_classroom` if not) and the `name` matches `<prefix><N digits>` (**422** on `name`), then PutItem `PK = CAMPUS#id`, `SK = RESERVABLE#id`; room-only `min/max_participants` + `is_classroom` dropped for `equipment` | Base |
| 28 | Eligible post-eval events (student step 1) | Query | per approved/finished submission compute the effective date (booking date when reserved, else `date_of_event`), keep those already passed with `EventWindow::EVALUATION` open, minus events that already have a `submitted`/`approved` POSTEVAL | GSI1 + Base |
| 29 | Org post-eval list (student dashboard) | Query | `GSI1PK = ORGANIZATION#id`, `GSI1SK` begins `POSTEVAL#` | GSI1 |
| 30 | OSAAR post-eval queue (cross-org) | Query | per org `GSI1PK = ORGANIZATION#id`, `GSI1SK` begins `POSTEVAL#` (optional `status` filter) | GSI1 |
| 31 | Single post-eval detail | GetItem | `PK = EVENT#id`, `SK = POSTEVAL#id` | Base |
| 32 | Aggregate event participants (post-eval Section 3) | Query | `PK = EVENT#id`; split `SK` begins `MEMBER#` (attendance; resolve names via `PK = SK = MEMBER#{studentId}`) vs `EVALUATION#` | Base |
| 33 | Write post-eval (gated) | Query → PutItem | enforce submission approved/finished + window open (**422**) + no active POSTEVAL (**409**), freeze the snapshot, PutItem `PK = EVENT#id`, `SK = POSTEVAL#id` (`attribute_not_exists(PK)`) | Base + GSI1 |
| 34 | Approve / deny post-eval (OSAAR) | UpdateItem | POSTEVAL `submitted → approved`/`denied`; on approve also SUBMISSION `approved → finished` (idempotent) | Base |

---

## Page / feature → objects accessed

| Page / feature | Objects read or written | Patterns |
|---|---|---|
| Student dashboard | ORGANIZATION, EVENT, SUBMISSION, ANNOUNCEMENT, COLLAB POINTER, POSTEVAL | 1, 2, 3, 4, 11, 13, 29 |
| Submission tracker / detail | SUBMISSION, NOTIFICATION, SIGNATORY (by copied id) | 5, 6 |
| New / edit submission (SAAF) | SUBMISSION, COLLAB POINTER, ORGANIZATION (directory), CAMPUS, RESERVABLE, BOOKING (holds + `booking_refs`) | 12, 15, 19, 20, 21, 23, 24 |
| Signatory desk (inbox) | SUBMISSION, SIGNATORY | 7, 9 |
| Signatory review (approve/return/deny/classify) | SUBMISSION, NOTIFICATION, BOOKING (release holds on deny/return) | 6, 16, 24 |
| Admin dashboard (submissions) | ORGANIZATION, SUBMISSION | 10 |
| Admin → Organizations | ORGANIZATION, SIGNATORY | 11, 12, 17 |
| Admin → Signatories | SIGNATORY, ORGANIZATION (desk guard) | 8, 18 |
| osaar → Campus | CAMPUS, RESERVABLE (delete guard) | 19, 20, 26 |
| cdm → Reservables (Add/View/Reserve) | CAMPUS, RESERVABLE, BOOKING | 20, 21, 22, 23, 25, 26, 27 |
| Student dashboard → request change (dialog) | SUBMISSION, RESERVATION_CHANGE, BOOKING (snapshot), NOTIFICATION | 6, 28, 29 |
| cdm → Reservations (resolve cancel / reschedule / deny) | RESERVATION_CHANGE, SUBMISSION, BOOKING, RESERVABLE, CAMPUS, NOTIFICATION | 20, 21, 23, 24, 30, 31 |
| About / Announcements | ANNOUNCEMENT | 13, 14 |
| Student → Post-evals (entry + wizard) | SUBMISSION, POSTEVAL, EVENT children (MEMBER#/EVALUATION#) | 28, 31, 32, 33 |
| Student dashboard → Post-eval panel | POSTEVAL | 29 |
| OSAAR → Post-evals (queue + review) | POSTEVAL, SUBMISSION (finish on approve) | 30, 31, 32, 34 |
