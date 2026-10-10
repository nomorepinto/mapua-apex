# Data Objects & Properties

All objects live in a **single DynamoDB table**. Each item is identified by a
partition key (`PK`) and a sort key (`SK`); several item types share one
partition so related records are read together in a single query. There are
**no foreign keys and no cascade**: related IDs are *copied* onto items and
resolved at write time, so deleting one item never rewrites another.

---

## ORGANIZATION

The student organization. Also the desk directory: it records which signatory
person occupies each approval role for this org.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `ORGANIZATION#uuid` |
| `SK` | string | `ORGANIZATION#uuid` (same as PK) |
| `name` | string | Display name |
| `is_higher_council` | boolean | Default `false`. When true, the Dean step is skipped in routing |
| `signatories` | list | Desk directory, one person per role: `{ role, signatory_id }` |
| `signatories[].role` | string | One of `adviser / dean / osaar / cdm / admin` |
| `signatories[].signatory_id` | string | Plain copy of a SIGNATORY id |

Allowed desk roles are stored in the order `adviser → dean → osaar → cdm → admin`
regardless of write order. `admin` may hold a desk but is **not** part of the
approval sequence. `osaar` and `cdm` desks are campus-wide (from
`OSAAR_SIGNATORY_ID` / `CDM_SIGNATORY_ID` in the API env), not stored per org.

---

## EVENT

A filing/event that owns one or more submissions. Its partition also holds the
event's SUBMISSION children.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `EVENT#uuid` |
| `SK` | string | `EVENT#uuid` (same as PK) |
| `sent_at` | timestamp | Creation time (UTC) |
| `GSI1PK` | string | `ORGANIZATION#uuid` — owning org (also identifies the *proponent* org for collaborations) |
| `GSI1SK` | timestamp | `sent_at` — for newest-first org event lists |

---

## SUBMISSION

A proposal paper (e.g. SAAF) filed under an event. Carries the full form body
plus routing state and index keys. This is the single source of truth for a
submission, including any collaboration.

### Identity, routing & indexes

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `EVENT#uuid` (parent event partition) |
| `SK` | string | `SUBMISSION#uuid` |
| `submission_type` | string | e.g. `saaf` |
| `sent_at` | timestamp | Submit time (UTC) |
| `status` | string | `pending / approved / denied / returned` |
| `current_signatory` | string | `SIGNATORY#uuid` holding the paper now |
| `signatory_sequence` | list | Ordered `SIGNATORY#uuid` routing snapshot, written at submit time |
| `collaboration.dependent_organization_ids` | list | `ORGANIZATION#uuid` dependents; empty/absent = no collaboration |
| `GSI1PK` | string | `ORGANIZATION#uuid` (proponent org) |
| `GSI1SK` | string | `SUBMISSION#uuid` |
| `GSI2PK` | string | `SIGNATORY#uuid` — sparse signatory inbox (present while `pending`/`returned`) |
| `GSI2SK` | timestamp | Desk queue time |

### activity_classification

| Property | Type | Notes |
|---|---|---|
| `activity_type` | string | `co-curricular / extra-curricular` |
| `total_org_members` | number | |
| `nature` | string | `major / minor` — set by OSAAR via the classification PATCH, not by the student create body |

### proponents[] (list of people)

`id`, `position_title`, `first_name`, `middle_name`, `last_name`, `suffix`,
`student_number`, `program_and_year`, `date_of_submission`, `department`,
`position_of_applicant`, `org_or_course_section`, `contact_number`,
`email_address`, `facebook_link`.

### activity_details

`title_and_nature`, `description`, `objectives`, `venue`, `date_of_event`,
`day_of_event`, `time_of_event`, `expected_participants`,
`individual_contribution`, `proposed_budget`.
`time_of_event` is 24-hour `"HH:MM - HH:MM"`; saved times fall between 7:00 AM
and 9:00 PM, end not earlier than start, and start ≠ end.

### institutional_alignment

`mission_statements { competitive, research, solutions }`,
`core_values_explanation`, `peo_explanation`, `sdg_explanation`.

### detailed_budget_proposal

`items[] { item_no, unit, quantity, price_per_unit, total }`, `grand_total`.

### venue_reservation & booking_refs

| Property | Type | Notes |
|---|---|---|
| `has_reservation` | boolean | Drives whether the CDM desk joins the routing chain |
| `reservations[]` | list | One entry per picked reservable: `{ reservable_id, campus_id, name, type, selections[], remarks }` |
| `reservations[].type` | string | `room` \| `equipment` |
| `reservations[].selections[]` | list | `{ date: "YYYY-MM-DD", slots: [int 0-11] }` — 0-based indices into the 07:00–21:00 / 70-min day (12 slots) |
| `booking_refs[]` | list | Sparse reverse index `{ pk: "RESERVABLE#uuid", sk: "BOOKING#uuid" }`; present only while the paper holds BOOKINGs. Released + removed on deny/return, reconciled on re-edit |

Legacy items stored before this shape may still carry `equipment_requested` /
`function_rooms` / `audiovisual_equipment`; reads tolerate both. On submit each
selection is validated against the reservable's weekly template and existing
BOOKINGs, then written as `source:"submission"` holds — a slot taken in the
meantime aborts with **409** and persists nothing.

---

## NOTIFICATION

One row in a submission's approval/timeline history. Stored in a partition
keyed by the submission id (a separate partition from the event).

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `SUBMISSION#uuid` |
| `SK` | string | `NOTIFICATION#timestamp` (identity; UTC second precision) |
| `signatory` | string | `SIGNATORY#uuid` author (snapshot) |
| `notif_type` | string | `approved / fully approved / denied / returned` |
| `comment` | string | Mandatory when `denied` or `returned` |

Approve / return / deny insert a NOTIFICATION row as a side effect. A PUT
replaces `notif_type` / `comment` in place and does **not** change the SK.

---

## SIGNATORY

A person (the signatory identity). Has **no** `organization_id`; desk
assignment lives on `ORGANIZATION.signatories`.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `SIGNATORY#uuid` |
| `SK` | string | `SIGNATORY#uuid` (same as PK) |
| `name` | string | |
| `role` | string | `adviser / cdm / dean / osaar / admin` |
| `department` | string | Deans only (e.g. `SOIT`) |
| `GSI4PK` | string | `ROLE#ADVISER / ROLE#CDM / ROLE#DEAN / ROLE#DEAN#{DEPARTMENT} / ROLE#OSAAR / ROLE#ADMIN` |
| `GSI4SK` | string | `SIGNATORY#uuid` |

Other items copy the signatory id rather than join back to SIGNATORY:
`ORGANIZATION.signatories[].signatory_id`, `SUBMISSION.current_signatory` /
`GSI2PK`, and `NOTIFICATION.signatory`. Renaming keeps the same uuid; deleting
a SIGNATORY does not rewrite those copies.

---

## COLLABORATION POINTER

An index-only item, one per dependent organization, that makes the proponent's
submission discoverable in a dependent's dashboard. It carries **no** form
content — the master SUBMISSION stays the single source of truth.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `ORGANIZATION#uuid` — the **dependent** org (not the proponent) |
| `SK` | string | `COLLAB#EVENT#uuid#SUBMISSION#uuid` |
| `event_id` | string | `EVENT#uuid` |
| `submission_id` | string | `SUBMISSION#uuid` |
| `sent_at` | timestamp | |

Queried from the dependent's partition (`SK` begins `COLLAB#`); no GSI is
needed because DynamoDB cannot index the N values of an array. A dependent may
read the shared submission and its NOTIFICATION timeline but cannot edit or
resubmit — only the proponent may.

---

## ANNOUNCEMENT

A campus-wide announcement. All announcements share one partition; the SK
(timestamp) is the identity. Admin Cognito group only.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `ANNOUNCEMENT` (constant) |
| `SK` | string | `timestamp` — identity (`sent_at` in the API); newest-first list |
| `content` | string | |

A PUT replaces `content` in place and does not change the SK.

---

## CAMPUS

A reservable campus (e.g. `Intramuros Campus`, `Makati Campus`), seeded by osaar
on the `/campus` page. The SAAF reservation step and the `activity_details.venue`
dropdown read the list.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `CAMPUS#uuid` |
| `SK` | string | `CAMPUS#uuid` (same as PK) |
| `name` | string | Display name |

List scans `PK` begins `CAMPUS#` AND `PK = SK`. Delete is guarded: **409** if any
RESERVABLE still lives under `PK = CAMPUS#id`. Rename in place (PUT) to keep the
same uuid so RESERVABLE children and stored booking `campus_id` snapshots stay
valid.

---

## RESERVABLE

A bookable room or equipment item under a campus. Its `SK` is globally unique and
doubles as the BOOKING partition key.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `CAMPUS#uuid` (parent campus) |
| `SK` | string | `RESERVABLE#uuid` |
| `name` | string | |
| `type` | string | `room` \| `equipment` |
| `schedule` | object | Recurring weekly template: `monday`..`saturday`, each exactly 12 booleans (one per 07:00–21:00 / 70-min slot; `true` = available). Sunday is never reservable; an absent day is all-unavailable |

Added/edited by cdm on the `/reservables` page (CSV for name+type, a grid for the
schedule). Delete is guarded: **409** if any BOOKING still occupies
`PK = RESERVABLE#id`.

---

## BOOKING

A concrete hold on a reservable's slots for specific dates. One BOOKING per
(reservable, submission) or per (reservable, CDM reserve action). Two flavors
share the item type, distinguished by `source`.

| Property | Type | Notes |
|---|---|---|
| `PK` | string | `RESERVABLE#uuid` |
| `SK` | string | `BOOKING#uuid` |
| `timestamp` | timestamp | Create time (UTC) |
| `schedule_selected` | list | `[{ date: "YYYY-MM-DD", slots: [int 0-11] }]` (normalized) |
| `source` | string | `submission` (SAAF-created hold) \| `cdm` (manual CDM hold) |
| `campus_id` | string | Bare campus uuid (snapshot) |
| `reservable_name` | string | Snapshot at write time |
| `reservable_type` | string | `room` \| `equipment` (snapshot) |

Submission-sourced (`source: "submission"`) adds GSI5 + traceability, and is
released on deny/return/re-edit via the SUBMISSION's `booking_refs`:

| Property | Type | Notes |
|---|---|---|
| `GSI5PK` | string | `ORGANIZATION#uuid` — owning org (org booking list) |
| `GSI5SK` | timestamp | `timestamp` |
| `event_id` / `submission_id` / `organization_id` | string | Bare uuids for traceability and read-only CDM labelling |

Manual (`source: "cdm"`) carries **no** GSI5 and **no** submission linkage (so it
never surfaces in an org's list); it is released only by CDM delete:

| Property | Type | Notes |
|---|---|---|
| `booked_by` | string | `SIGNATORY#uuid` (the CDM signatory) |
| `reason` | string | Optional purpose note (omitted when blank) |

Both flavors share one availability engine: a slot is free only when the weekly
template allows it AND no BOOKING (either source) occupies that date+slot.
Conflict detection runs on the base RESERVABLE partition — never GSI5 — so it
works before the (operator-provisioned) organization index exists.
