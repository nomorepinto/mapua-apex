# API routes

All v1 routes sit under `/api/v1`. Collections and single resources are wrapped in Laravel's `data` key.

## Auth

Every **v1** route needs a JWT (except the unauthenticated **Public** and **Health** endpoints documented below):

```http
Authorization: Bearer <Cognito JWT>
```

Send the Cognito **ID** token when the route needs `custom:organization_id` or `custom:signatory_id`. The API accepts ID and access tokens, but custom attributes are not on access tokens by default (Amplify: `session.tokens.idToken`). After you change a Cognito attribute, the user must sign in again so the new token includes it.

`X-Api-Key` is not read by the Laravel API.

`cognito:groups` (case-insensitive) must match the route:

| Route prefix | Allowed groups | Also allowed |
| :---- | :---- | :---- |
| `/students` | `student`, `students`, `org_submitter` | `admin` |
| `/signatories` | `signatory`, `signatories`, `org_adviser`, `dean`, `osaar`, `cdm_reviewer`, `cdm` | `admin` |
| `/admins` | `admin`, `osaar` | — |

- **Student** JWT needs `custom:organization_id` (plain `organization_id` is also accepted) set to the Dynamo org UUID from `POST /api/v1/admins/organizations`, optionally prefixed `ORGANIZATION#`. All student routes use that claim only. Missing claim → `401`. Another org’s event or unknown org on `GET /students/organization` → `404`.
- **Signatory** JWT needs `custom:signatory_id` (plain `signatory_id` is also accepted) set to the Dynamo signatory id from `POST /api/v1/admins/signatories`, optionally prefixed `SIGNATORY#`. All signatory routes use that claim only. Missing claim → `401`. Submission not on their desk, or unknown signatory on `GET /signatories/me` → `404`.
- **Admin** JWT does not need those claims. Admin list/show routes are global. To call a student or signatory route as admin, send `X-Organization-Id` and/or `X-Signatory-Id` when the JWT does not already carry the matching claim. If those are also omitted, student routes use org id `admin-org` and signatory routes use a built-in default signatory id.

Wrong or missing JWT, group, or required claim → `401`. Identity provider JWKS down → `503`. Over limit → `429` (about 60 reads/min and 10 writes/min per caller). Cross-org / off-desk access → `404` (not `403`).

In **PUT** examples, lines marked `← CHANGE THIS` are the fields you typically edit. Send the full body anyway; the API replaces the SAAF document, not a patch of one key.

---

## Health

No Cognito JWT.

| Method | Endpoint | Example JSON |
| :---- | :---- | :---- |
| **GET** | `/api/ping` | **Response `200`.** Throttled with the student limiter. <pre>{<br>  "ok": true<br>}</pre> |

---

## Public

No Cognito JWT. Served under `/api/v1` like every other route, but open to anonymous callers — the landing page reads announcements before sign-in.

| Method | Endpoint | Example JSON |
| :---- | :---- | :---- |
| **GET** | `/api/v1/public/announcements` | **Response `200`** — all announcements, newest `sent_at` first. Same shape as the admin/student announcement lists. Throttled with the student limiter. <pre>{<br>  "data": [<br>    {<br>      "sent_at": "2026-09-15T08:00:00Z",<br>      "content": "OSAAR office hours are 9:00–17:00."<br>    }<br>  ]<br>}</pre> |

---

## Routing (create / approve hops)

Sequence starts at Adviser, then Dean (only when `activity_type` is `co-curricular`), then OSAAR, then CDM (only when `venue_reservation.has_reservation` is `true`). If the submitting organization’s `is_higher_council` is `true`, Dean is skipped even for co-curricular papers: Adviser, then OSAAR, then CDM when there is a reservation.

The full ordered list is resolved **once at submit time** and stored on the submission as `signatory_sequence` (array of plain signatory ids, no `SIGNATORY#` prefix). Every submission response now includes it. Approve simply walks that stored list and advances `current_signatory` to the next id; it does **not** re-resolve desks on each hop. A student PUT that changes `activity_type` or `venue_reservation.has_reservation` recomputes and rewrites `signatory_sequence`. Legacy submissions written before this field existed have `signatory_sequence: []` until their first approve, which resolves and persists it.

- **Adviser** and **Dean** come from that organization’s desk list (`ORGANIZATION.signatories`). Missing desk → **422** `"No {role} signatory is assigned for this organization."` Higher-council orgs still need an Adviser desk; they do not need Dean.
- **OSAAR** and **CDM** come from backend env `OSAAR_SIGNATORY_ID` and `CDM_SIGNATORY_ID` (plain uuid or `SIGNATORY#uuid`). Org desks with those roles are stored if you send them, but they are **not** used to pick the next hop. Missing env → **422** `"No {role} signatory is configured."`

**Collaboration.** A submission may list `collaboration.dependent_organization_ids` (plain org uuids, no `ORGANIZATION#` prefix; the proponent org is excluded). When dependents are present the adviser/dean stage expands over `[proponent, ...dependents]` in submitted order: **all advisers first, then all deans** (a Dean step for an org exists only when that paper is `co-curricular` **and** that org’s `is_higher_council` is not `true`), then OSAAR, then CDM when there is a reservation. Signatory ids are de-duplicated across the whole chain (first occurrence wins), so a person who is both adviser and dean signs once. A missing adviser / required dean / unconfigured campus desk → **422** `UnresolvableSignatoryRoute`. The approve/return/deny walk is unchanged; a longer stored `signatory_sequence` just means more desks. Dependents get a read-only copy of the submission and its notifications in their dashboard (indexed by an `ORGANIZATION#<dep>` + `COLLAB#…` pointer item); only the proponent can edit or resubmit. Student list/show return `role` (`proponent` | `dependent`) so the UI can hide edit actions for dependents. Detail responses (`GET` one for student / signatory / admin) also expand the stored `signatory_sequence` at read time into `signatory_chain`: an ordered array of `{ signatory_id, role, organization_id, organization_name }` where each adviser/dean is qualified by the organization whose desk it is (proponent first, then dependents, matching the sequence) and the shared campus desks (OSAAR, CDM) carry a `null` organization. This lets the tracker label each hop "{organization_name}'s {role}" so duplicate roles across collaborating orgs stay distinct. It is derived, not stored, and appears only on detail responses (list endpoints omit it).

Rename campus people with `PUT /admins/signatories/{id}` on the same uuid. If you mint a new OSAAR or CDM uuid, update the matching env var and restart / `config:clear`.

---

## Transactional emails (SES)

Every NOTIFICATION write also fires best-effort emails via SES (`Aws\Ses\SesClient` directly; no Laravel Mail). Sends never fail the API response — an unresolvable address or SES outage is logged and skipped. The student address is `proponents[0].email_address` on the submission; a signatory address is resolved from the Cognito user whose `custom:signatory_id` attribute equals the signatory uuid (`AdminListUsers` on the pool in `AWS_COGNITO_REGION` / `AWS_DEFAULT_REGION`). `Source` is `MAIL_FROM_ADDRESS` (must be a verified SES identity); sending is skipped entirely while it is unconfigured.

| Trigger | Emails sent |
| :---- | :---- |
| Student POST `/students/submissions` | First desk in `signatory_sequence`: "new event submission from {org name}" |
| Student PUT a **returned** paper | The desk it now sits on (kept desk or sequence[0]): "resubmitted for your review". Plain edits of `pending` papers send nothing |
| Approve (mid-chain) | Student: "{approver} approved" **and** next desk: "new event submission from {org name}" |
| Approve (final hop) | Student: "fully approved" **and** an "event scheduled" timeline notice + email carrying the arcus attendance & evaluation links |
| Deny / Return | Student: "denied" / "returned for revision", including the signatory comment |
| Signatory or student POST notifications | Student: the row's `notif_type` + comment |
| PUT notifications (edit a row) | Nothing |

---

## Arcus service routes (server-to-server)

Not Cognito-JWT routes. The arcus companion apps (arcus-attendance-system, arcus-evaluation-system) call these from their **own server** using a shared secret, because their users authenticate through a **different** Cognito app client whose tokens this API cannot verify. Every request needs:

```http
X-Arcus-Service-Token: <ARCUS_SERVICE_TOKEN>

---

## Student routes

`Authorization: Bearer <student ID token>`

Scoped to the JWT org (`custom:organization_id`). List, deadlines, and `GET /organization` return only that org (first **25** events). Event paths return `404` if the event belongs to another org.

| Method | Endpoint | Example JSON |
| :---- | :---- | :---- |
| **GET** | `/api/v1/students/submissions` | **Response `200`** — the JWT org’s own (proponent) submissions **merged with** collaboration submissions where the org is a dependent; de-duplicated, newest `sent_at` first. Each item carries `role` (`proponent` | `dependent`). Other orgs are omitted. <pre>{<br>  "data": [<br>    {<br>      "event_id": "e001",<br>      "submission_id": "s001",<br>      "organization_id": "a1b2",<br>      "submission_type": "saaf",<br>      "sent_at": "2026-09-10T14:00:00Z",<br>      "status": "pending",<br>      "current_signatory": "adv001",<br>      "activity_classification": {<br>        "activity_type": "extra-curricular",<br>        "total_org_members": 42<br>      },<br>      "proponents": [ { "id": "p001", "first_name": "Nicole", "last_name": "Santos", "email_address": "nsantos@mymail.mapua.edu.ph" } ],<br>      "activity_details": {<br>        "title_and_nature": "Hack Night: Intro to Web Dev",<br>        "venue": "MPH 2nd Floor",<br>        "date_of_event": "2026-10-05"<br>      },<br>      "institutional_alignment": { "...": "..." },<br>      "detailed_budget_proposal": { "grand_total": 3000 },<br>      "venue_reservation": { "has_reservation": true }<br>    }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/students/events/{event}/submissions/{submission}` | **Response `200`** — one full SAAF. Readable by the proponent org and any collaboration **dependent** (each gets the same record, tagged `role`; a non-proponent, non-dependent org → **404**). Path uses both ids because PK is `EVENT#` + `SUBMISSION#`. Detail responses also include `signatory_chain`: the `signatory_sequence` expanded at read time into ordered `{ signatory_id, role, organization_id, organization_name }` entries so a collaboration renders each hop as "{organization_name}'s {role}" (campus desks OSAAR / CDM have a `null` organization). `signatory_chain` is **detail-only** — the list endpoints omit it. <pre>{<br>  "data": {<br>    "event_id": "e001",<br>    "submission_id": "s001",<br>    "submission_type": "saaf",<br>    "sent_at": "2026-09-10T14:00:00Z",<br>    "status": "pending",<br>    "current_signatory": "adv001",<br>    "signatory_sequence": ["adv001", "osaar001", "cdm001"],<br>    "signatory_chain": [<br>      { "signatory_id": "adv001", "role": "adviser", "organization_id": "a1b2", "organization_name": "Mapua Computing Society" },<br>      { "signatory_id": "osaar001", "role": "osaar", "organization_id": null, "organization_name": null },<br>      { "signatory_id": "cdm001", "role": "cdm", "organization_id": null, "organization_name": null }<br>    ],<br>    "role": "proponent",<br>    "collaboration": { "dependent_organization_ids": [] },<br>    "activity_classification": {<br>      "activity_type": "extra-curricular",<br>      "total_org_members": 42<br>    },<br>    "proponents": [ { "id": "p001", "position_title": "President", "first_name": "Nicole", "middle_name": "R", "last_name": "Santos", "suffix": "", "student_number": "2021-00123", "program_and_year": "BSCS-3", "date_of_submission": "2026-09-10", "department": "CCIS", "position_of_applicant": "President", "org_or_course_section": "Mapua Computing Society", "contact_number": "09171234567", "email_address": "nsantos@mymail.mapua.edu.ph", "facebook_link": "fb.com/nicole.santos" } ],<br>    "activity_details": {<br>      "title_and_nature": "Hack Night: Intro to Web Dev",<br>      "description": "A beginner-friendly hackathon night.",<br>      "objectives": "Introduce first-year students to web development.",<br>      "venue": "MPH 2nd Floor",<br>      "date_of_event": "2026-10-05",<br>      "end_date_of_event": "2026-10-05",<br>      "day_of_event": "Monday",<br>      "time_of_event": "17:00",<br>      "expected_participants": 60,<br>      "individual_contribution": 0,<br>      "proposed_budget": 5000<br>    },<br>    "institutional_alignment": {<br>      "mission_statements": { "competitive": true, "research": false, "solutions": true },<br>      "core_values_explanation": "Promotes collaboration and innovation.",<br>      "peo_explanation": "Builds technical competency outside curriculum.",<br>      "sdg_explanation": "Supports SDG 4: Quality Education."<br>    },<br>    "detailed_budget_proposal": {<br>      "items": [ { "item_no": "1", "unit": 1, "quantity": 60, "price_per_unit": 50, "total": 3000 } ],<br>      "grand_total": 3000<br>    },<br>    "venue_reservation": {<br>      "has_reservation": true,<br>      "equipment_requested": { "monoblock_chairs": true, "whiteboards": false, "tables": true, "rostrum": false, "flags_with_stand": false, "panel_boards": false, "others_specified": "" },<br>      "general_facilities": { "purpose": "Hackathon venue", "items": [ { "item": "MPH", "date_of_use": "2026-10-05", "time_of_use": "17:00", "location": "MPH 2F" } ] },<br>      "function_rooms": { "purpose": "", "items": [] },<br>      "audiovisual_equipment": { "purpose": "Projector for demo", "items": [ { "date_needed": "2026-10-05", "time_needed": "17:00", "equipment_needed": "Projector", "remarks": "1 unit" } ] }<br>    }<br>  }<br>}</pre> |
| **POST** | `/api/v1/students/submissions` | **Request body** — if `event_id` does not exist yet, the API creates that event under the JWT org. `submission_id` is a generated uuid. First desk is the first hop in the org’s sequence (Adviser). See [Routing](#routing-create--approve-hops). **422** if the adviser desk is missing, if the dean desk is missing (unless higher council), or campus OSAAR/CDM env ids are missing. Optional `collaboration.dependent_organization_ids` (plain org uuids, no prefix) makes those orgs read-only dependents; each must exist (**422** otherwise) and cannot be the JWT org. **Response `201`** is the same shape as GET one. Full required body is in [SAAF create body](#saaf-create-body) below. Compact: <pre>{<br>  "event_id": "e001",<br>  "submission_type": "saaf",<br>  "collaboration": { "dependent_organization_ids": ["a1b2"] },<br>  "activity_classification": {<br>    "activity_type": "extra-curricular",<br>    "total_org_members": 42<br>  },<br>  "proponents": [ { "...": "see SAAF create body" } ],<br>  "activity_details": { "...": "see SAAF create body" },<br>  "institutional_alignment": { "...": "see SAAF create body" },<br>  "detailed_budget_proposal": { "...": "see SAAF create body" },<br>  "venue_reservation": { "has_reservation": true, "...": "see SAAF create body" }<br>}</pre> |
| **PUT** | `/api/v1/students/events/{event}/submissions/{submission}` | **Request body** — same SAAF fields as POST **except omit `event_id`** (it is in the URL). Only the **proponent** org (the event’s `GSI1PK`) may edit or resubmit; a collaboration **dependent** calling this route → **404**. Allowed when `status` is `pending` or `returned`. Updating `collaboration.dependent_organization_ids` reconciles the dependent pointer items (adds new, removes dropped). **422** `"Approved submissions cannot be edited."` / `"Denied submissions cannot be edited."` PUT still resolves the full sequence, so empty campus env ids still **422**. If the paper is `returned`, `status` goes back to `pending` and `current_signatory` / GSI2 stay on the same desk **only if** that desk is still in the recomputed `signatory_sequence`; otherwise routing restarts at the first hop. If the paper is `pending`, routing restarts at Adviser. PUT rewrites `signatory_sequence` from the (possibly changed) classification / venue flags. **Response `200`** is the updated GET-one object. Highlight typical resubmit edits: <pre>{<br>  "submission_type": "saaf",<br>  "activity_classification": {<br>    "activity_type": "extra-curricular",   ← CHANGE THIS to re-route (Dean hop for co-curricular)<br>    "total_org_members": 42<br>  },<br>  "proponents": [ { "...": "same as create" } ],<br>  "activity_details": {<br>    "title_and_nature": "Hack Night: Intro to Web Dev (revised)",  ← CHANGE THIS<br>    "description": "Updated description after return.",            ← CHANGE THIS<br>    "objectives": "Introduce first-year students to web development.",<br>    "venue": "MPH 2nd Floor",<br>    "date_of_event": "2026-10-12",                                 ← CHANGE THIS<br>    "end_date_of_event": "2026-10-12",                             ← CHANGE THIS (optional)<br>    "day_of_event": "Monday",<br>    "time_of_event": "17:00",<br>    "expected_participants": 60,<br>    "individual_contribution": 0,<br>    "proposed_budget": 4500                                        ← CHANGE THIS<br>  },<br>  "institutional_alignment": { "...": "same as create" },<br>  "detailed_budget_proposal": {<br>    "items": [ { "item_no": "1", "unit": 1, "quantity": 60, "price_per_unit": 40, "total": 2400 } ],  ← CHANGE THIS<br>    "grand_total": 2400                                              ← CHANGE THIS<br>  },<br>  "venue_reservation": {<br>    "has_reservation": true,                                         ← CHANGE THIS to re-route (CDM hop)<br>    "equipment_requested": { "...": "same as create" },<br>    "general_facilities": { "...": "same as create" },<br>    "function_rooms": { "purpose": "", "items": [] },<br>    "audiovisual_equipment": { "...": "same as create" }<br>  }<br>}</pre> |
| **GET** | `/api/v1/students/events/{event}/submissions/{submission}/notifications` | **Response `200`** — stepper / timeline. Readable by the proponent and its collaboration **dependents** (shared timeline). <pre>{<br>  "data": [<br>    {<br>      "submission_id": "s001",<br>      "sent_at": "2026-09-11T08:30:00Z",<br>      "signatory": "adv001",<br>      "notif_type": "denied",<br>      "comment": "Budget is incomplete."<br>    }<br>  ]<br>}</pre>`notif_type` is `approved`, `fully approved`, `denied`, or `returned`. Comment is required on `denied` and `returned` (max 5000). Approve writes `comment` as `""`. |
| **POST** | `/api/v1/students/events/{event}/submissions/{submission}/notifications` | **Request body** — appends a timeline row. **Proponent only** (a dependent → **404**). Does **not** change submission `status` or GSI2. `signatory` must be an existing person. Comment required when `notif_type` is `denied` or `returned`. **Response `201`** — `sent_at` is the UTC create time (SK). <pre>{<br>  "signatory": "adv001",<br>  "notif_type": "returned",<br>  "comment": "Please revise the venue."<br>}</pre>**Response:** <pre>{<br>  "data": {<br>    "submission_id": "s001",<br>    "sent_at": "2026-09-11T08:30:00Z",<br>    "signatory": "adv001",<br>    "notif_type": "returned",<br>    "comment": "Please revise the venue."<br>  }<br>}</pre> |
| **PUT** | `/api/v1/students/events/{event}/submissions/{submission}/notifications/{notification}` | **Request body** — full replace of `signatory`, `notif_type`, and `comment`. **Proponent only** (a dependent → **404**). Path `{notification}` is the original `sent_at` (`2026-09-11T08:30:00Z` or `NOTIFICATION#…`). SK does not change. Unknown → **404**. **Response `200`**. <pre>{<br>  "signatory": "adv001",<br>  "notif_type": "returned",                                          ← CHANGE THIS<br>  "comment": "Recalculate grand_total and resubmit."                 ← CHANGE THIS<br>}</pre> |
| **GET** | `/api/v1/students/deadlines` | **Response `200`** — upcoming deadlines (`deadline` ≥ now) for the org’s events (first 25 events). <pre>{<br>  "data": [<br>    {<br>      "event_id": "e001",<br>      "deadline_id": "d001",<br>      "sent_at": "2026-09-01T09:00:00Z",<br>      "deadline": "2026-09-20T23:59:59Z"<br>    }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/students/organization` | **Response `200`** — the JWT org (`custom:organization_id`) and its desk list. Same shape as one item from admin GET `/organizations`. Unknown org id → **404**. Routing uses adviser from this list, and dean unless `is_higher_council` is `true`. <pre>{<br>  "data": {<br>    "organization_id": "a1b2",<br>    "name": "Mapua Computing Society",<br>    "is_higher_council": false,<br>    "signatories": [<br>      { "role": "adviser", "signatory_id": "adv001" },<br>      { "role": "dean", "signatory_id": "dean001" }<br>    ]<br>  }<br>}</pre> |
| **GET** | `/api/v1/students/organizations` | **Response `200`** — directory of all organizations (`{ organization_id, name }` only) for picking collaboration dependents. Includes the JWT org; the client excludes it from the picker. <pre>{<br>  "data": [<br>    { "organization_id": "a1b2", "name": "Mapua Computing Society" },<br>    { "organization_id": "c3d4", "name": "IEEE Mapua" }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/students/announcements` | **Response `200`** — all announcements, newest `sent_at` first. Same objects as admin GET `/admins/announcements`. Read-only. <pre>{<br>  "data": [<br>    {<br>      "sent_at": "2026-09-15T08:00:00Z",<br>      "content": "OSAAR office hours are 9:00–17:00."<br>    }<br>  ]<br>}</pre> |

---

## Signatory routes

`Authorization: Bearer <signatory ID token>`

Scoped to the JWT desk (`custom:signatory_id`). `GET /me` is that person. The queue is that signatory only (pending and returned papers on GSI2).

| Method | Endpoint | Example JSON |
| :---- | :---- | :---- |
| **GET** | `/api/v1/signatories/me` | **Response `200`** — the JWT signatory (`custom:signatory_id`). Same person object as admin GET list. `organization_id` is unused (`null`; not stored on the SIGNATORY item). Unknown signatory id → **404**. <pre>{<br>  "data": {<br>    "signatory_id": "adv001",<br>    "name": "Prof. Juan Dela Cruz",<br>    "role": "adviser",<br>    "department": null,<br>    "organization_id": null<br>  }<br>}</pre> |
| **GET** | `/api/v1/signatories/submissions` | **Response `200`** — items currently on this JWT signatory’s desk (GSI2), including `returned` papers. Same submission objects as the student list. <pre>{<br>  "data": [<br>    {<br>      "event_id": "e001",<br>      "submission_id": "s001",<br>      "status": "pending",<br>      "current_signatory": "adv001",<br>      "activity_details": { "title_and_nature": "Hack Night: Intro to Web Dev" }<br>    }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/signatories/submissions/history` | **Response `200`** — submission history for this JWT signatory. Scoped to the role: OSAAR/CDM/Admin see all submissions across orgs; Advisers see submissions from organizations they handle or are in sequence for; Deans see event proposals under their department. Excludes items currently on their active review queue. <pre>{<br>  "data": [<br>    {<br>      "event_id": "e001",<br>      "submission_id": "s001",<br>      "status": "approved",<br>      "organization_name": "Mapua Computing Society",<br>      "activity_details": { "title_and_nature": "Hack Night: Intro to Web Dev" }<br>    }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/signatories/events/{event}/submissions/{submission}` | **Response `200`** — full SAAF, only if `current_signatory` is this JWT signatory. Same body as student GET one. **404** if it is not on their desk. |
| **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/approve` | **No request body.** Allowed when `status` is `pending` or `returned` and the paper is on this desk. Otherwise **422** `"This submission is no longer open for review."` Hopping to the next desk sets `status: "pending"`. Extra-curricular + venue reservation advances Adviser → OSAAR (then CDM). Co-curricular inserts Dean after Adviser unless the org is a higher council. Higher-council orgs skip Dean only. Last step sets `status: "approved"`, drops GSI2, and leaves the queue. **Response `200`**. <pre>{<br>  "data": {<br>    "event_id": "e001",<br>    "submission_id": "s001",<br>    "status": "pending",<br>    "current_signatory": "osaar001",<br>    "signatory_sequence": ["adv001", "osaar001", "cdm001"]<br>  }<br>}</pre>After the last approval: `"status": "approved"` and `"current_signatory"` stays the last approver. |
| **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/return` | **Request body** — `comment` is required (1–5000 chars). Sets `status: "returned"`. The paper stays on this desk (GSI2 kept) and the student can edit it. **Response `200`**. <pre>{<br>  "comment": "Budget is incomplete. Recalculate grand_total and resubmit."<br>}</pre> |
| **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/deny` | **Request body** — `comment` is required (1–5000 chars). Final rejection: `status: "denied"`, GSI2 dropped, student cannot edit. **Response `200`**. <pre>{<br>  "comment": "This activity is not approved for this term."<br>}</pre> |
| **PATCH** | `/api/v1/signatories/events/{event}/submissions/{submission}/classification` | **Request body** — `nature` is required (`major` \| `minor`, case-insensitive; stored lowercase). Sets `activity_classification.nature` on the SAAF (OSAAR classification step). Allowed only when the paper is on this JWT signatory’s desk; otherwise **404**. Does **not** change `status`, routing, or GSI2. **Response `200`** is the updated submission object. <pre>{<br>  "nature": "major"<br>}</pre> |
| **POST** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications` | **Request body** — appends a timeline row on an **open** desk (`pending` or `returned`). Stamps `signatory` from the JWT (`custom:signatory_id`); a body `signatory` is ignored. Does **not** change submission status. Same `notif_type` / `comment` rules as the student POST. **404** if the paper is not on this desk. **Response `201`**. <pre>{<br>  "notif_type": "returned",<br>  "comment": "Please revise the budget."<br>}</pre> |
| **PUT** | `/api/v1/signatories/events/{event}/submissions/{submission}/notifications/{notification}` | **Request body** — replace `notif_type` and `comment` on a row this JWT signatory authored. Path is `sent_at`. SK and `signatory` stay the same. Unknown or another desk’s row → **404**. **Response `200`**. <pre>{<br>  "notif_type": "returned",                    ← CHANGE THIS<br>  "comment": "Recalculate grand_total."        ← CHANGE THIS<br>}</pre> |

---

## Admin routes

`Authorization: Bearer <admin ID token>` (`admin` or `osaar` Cognito group)

Admin list/show routes are global (not scoped by org). Stamp `organization_id` from `POST /organizations` onto Cognito students as `custom:organization_id`, and `signatory_id` from `POST /signatories` onto Cognito signatories as `custom:signatory_id`.

Signatories are people identified by `signatory_id`. Org desks (`ORGANIZATION.signatories`) are a separate list on the organization. Set them with `POST` / `PUT /organizations`. Desk `role` is `adviser`, `dean`, `osaar`, `cdm`, or `admin` — one desk per role, one person per desk. The API stores that list in role order (adviser → dean → osaar → cdm → admin). Routing uses the org list for **adviser and dean only**. `POST` / `PUT /signatories` do **not** write that list. `DELETE /signatories/{id}` and `DELETE /organizations/{id}` exist but are **guarded**: they permanently remove the item only when nothing still references it, otherwise they return **409**. A signatory delete is blocked while the person occupies an org desk or has an in-flight `GSI2` queue item; an organization delete is blocked while it owns events/submissions (`GSI1`) or collaboration pointers. Delete does **not** rewrite notification snapshots or Cognito `custom:signatory_id` / `custom:organization_id`, so to rename or reassign a person prefer `PUT` **in place** on the same uuid. A new uuid does not move in-flight `GSI2` queues, org desks, notification snapshots, or Cognito `custom:signatory_id`.

| Method | Endpoint | Example JSON |
| :---- | :---- | :---- |
| **GET** | `/api/v1/admins/submissions` | **Response `200`** — submissions grouped by organization. The list loads organizations, then queries GSI1 (`GSI1PK = ORGANIZATION#<id>` and `GSI1SK` begins with `SUBMISSION#`). Optional query: `?status=pending` (`pending` \| `approved` \| `denied` \| `returned`), `?activity_type=extra-curricular`, and `?organization_id=` (plain uuid or `ORGANIZATION#uuid`; limits the query to that one partition). Each item includes `GSI1PK`, `organization_id` (that key without the prefix), and `organization_name` from the matching ORGANIZATION item. Same other fields as student GET list. |
| **GET** | `/api/v1/admins/events/{event}/submissions/{submission}` | **Response `200`** — full SAAF plus timeline, including the detail-only `signatory_chain` (same expansion as the student GET one). <pre>{<br>  "data": {<br>    "event_id": "e001",<br>    "submission_id": "s001",<br>    "status": "denied",<br>    "current_signatory": "adv001",<br>    "signatory_sequence": ["adv001", "osaar001", "cdm001"],<br>    "signatory_chain": [<br>      { "signatory_id": "adv001", "role": "adviser", "organization_id": "a1b2", "organization_name": "Mapua Computing Society" },<br>      { "signatory_id": "osaar001", "role": "osaar", "organization_id": null, "organization_name": null },<br>      { "signatory_id": "cdm001", "role": "cdm", "organization_id": null, "organization_name": null }<br>    ],<br>    "activity_details": { "...": "full SAAF" },<br>    "notifications": [<br>      {<br>        "submission_id": "s001",<br>        "sent_at": "2026-09-11T08:30:00Z",<br>        "signatory": "adv001",<br>        "notif_type": "denied",<br>        "comment": "Fix the budget."<br>      }<br>    ]<br>  }<br>}</pre> |
| **GET** | `/api/v1/admins/announcements` | **Response `200`** — all announcements, newest `sent_at` first. <pre>{<br>  "data": [<br>    {<br>      "sent_at": "2026-09-15T08:00:00Z",<br>      "content": "OSAAR office hours are 9:00–17:00."<br>    }<br>  ]<br>}</pre> |
| **GET** | `/api/v1/admins/announcements/{announcement}` | **Response `200`**. Path `{announcement}` is `sent_at` (`2026-09-15T08:00:00Z`). Unknown → **404**. <pre>{<br>  "data": {<br>    "sent_at": "2026-09-15T08:00:00Z",<br>    "content": "OSAAR office hours are 9:00–17:00."<br>  }<br>}</pre> |
| **POST** | `/api/v1/admins/announcements` | **Request body.** `content` is required (1–5000 chars). **Response `201`** — `sent_at` is assigned as the UTC create time (SK). <pre>{<br>  "content": "Campus is closed on Friday."<br>}</pre>**Response:** <pre>{<br>  "data": {<br>    "sent_at": "2026-09-15T08:00:00Z",<br>    "content": "Campus is closed on Friday."<br>  }<br>}</pre> |
| **PUT** | `/api/v1/admins/announcements/{announcement}` | **Request body** — replaces `content`. Path is the original `sent_at` (SK does not change). Unknown → **404**. **Response `200`**. <pre>{<br>  "content": "OSAAR office hours are 10:00–16:00."  ← CHANGE THIS<br>}</pre> |
| **DELETE** | `/api/v1/admins/announcements/{announcement}` | **No request body.** Path is `sent_at`. **Response `204`**. Unknown → **404**. |
| **GET** | `/api/v1/admins/organizations` | **Response `200`**. `signatories` is the org desk list. Empty until you send `signatories` on `POST` or `PUT /organizations` (creating a signatory person does not fill it). Desks are stored in role order: adviser, dean, osaar, cdm, admin. Only adviser and dean are used when routing a paper. Dean is skipped when `is_higher_council` is `true`; Adviser is not. `is_higher_council` defaults to `false`. <pre>{<br>  "data": [<br>    {<br>      "organization_id": "a1b2",<br>      "name": "Mapua Computing Society",<br>      "is_higher_council": false,<br>      "signatories": [<br>        { "role": "adviser", "signatory_id": "adv001" },<br>        { "role": "dean", "signatory_id": "dean001" }<br>      ]<br>    }<br>  ]<br>}</pre> |
| **POST** | `/api/v1/admins/organizations` | **Request body.** Optional `signatories` is the desk list (`role` + existing `signatory_id`). `role` is `adviser`, `dean`, `osaar`, `cdm`, or `admin` — one desk per role, one person per desk. Optional `is_higher_council` (boolean, default `false`) skips Dean when routing that org’s papers. Adviser still reviews first. Omit `signatories` and the org starts with `signatories: []`. Unknown signatory id → **422**. **Response `201`** includes a generated `organization_id` — put that value on each student Cognito user as `custom:organization_id`. Stored desks are reordered (adviser → dean → osaar → cdm → admin) even if you send them in another order. Typical body (org desks only): <pre>{<br>  "name": "IEEE Mapua",<br>  "is_higher_council": false,<br>  "signatories": [<br>    { "role": "adviser", "signatory_id": "adv001" },<br>    { "role": "dean", "signatory_id": "dean001" }<br>  ]<br>}</pre>**Response:** <pre>{<br>  "data": {<br>    "organization_id": "3f2c1a90-....",<br>    "name": "IEEE Mapua",<br>    "is_higher_council": false,<br>    "signatories": [<br>      { "role": "adviser", "signatory_id": "adv001" },<br>      { "role": "dean", "signatory_id": "dean001" }<br>    ]<br>  }<br>}</pre> |
| **PUT** | `/api/v1/admins/organizations/{organization}` | **Request body** — full replace of `name` and `signatories` (send the list you want kept; `[]` clears desks). Optional `is_higher_council`; omit it to keep the stored value. Path is the org id (`a1b2` or `ORGANIZATION#a1b2`). Same desk rules as POST. Unknown id → **404**. Unknown signatory id → **422**. Does **not** rewrite in-flight submissions. **Response `200`**. <pre>{<br>  "name": "IEEE Mapua",                    ← CHANGE THIS<br>  "is_higher_council": true,               ← CHANGE THIS<br>  "signatories": [<br>    { "role": "adviser", "signatory_id": "adv001" },<br>    { "role": "dean", "signatory_id": "dean001" }  ← CHANGE THIS<br>  ]<br>}</pre> |
| **DELETE** | `/api/v1/admins/organizations/{organization}` | **No request body.** Permanently removes the organization. Path is the org id (`a1b2` or `ORGANIZATION#a1b2`). **Response `204`**. Unknown id → **404**. **409** if it still owns events/submissions (`GSI1`) or collaboration pointers — resolve those first. Does **not** rewrite Cognito `custom:organization_id`. |
| **GET** | `/api/v1/admins/signatories` | **Response `200`**. People only — not scoped by org. `department` is set for deans (`ROLE#DEAN#{DEPARTMENT}`). `organization_id` is unused (`null`; not stored on the SIGNATORY item). <pre>{<br>  "data": [<br>    {<br>      "signatory_id": "adv001",<br>      "name": "Prof. Juan Dela Cruz",<br>      "role": "adviser",<br>      "department": null,<br>      "organization_id": null<br>    },<br>    {<br>      "signatory_id": "dean001",<br>      "name": "Dean Maria Santos",<br>      "role": "dean",<br>      "department": "SOIT",<br>      "organization_id": null<br>    }<br>  ]<br>}</pre>`role` is `adviser`, `cdm`, `dean`, `osaar`, or `admin`. This `admin` is a signatory desk role, not the Cognito `admin` group. |
| **POST** | `/api/v1/admins/signatories` | **Request body.** Creates a person (`PK`/`SK` `SIGNATORY#{uuid}`). `role` is `adviser`, `cdm`, `dean`, `osaar`, or `admin`. GSI4 is `ROLE#{ROLE}`, or `ROLE#DEAN#{DEPARTMENT}` when `role` is `dean` and `department` is sent (stored uppercase, e.g. `soit` → `SOIT`). `department` is ignored unless `role` is `dean`. Does **not** take `organization_id` and does **not** write `ORGANIZATION.signatories`. After creating OSAAR or CDM, put that uuid in `OSAAR_SIGNATORY_ID` / `CDM_SIGNATORY_ID`. `admin` is not in the approval sequence. **Response `201`**. Put `signatory_id` on the Cognito user as `custom:signatory_id`. <pre>{<br>  "name": "Prof. Juan Dela Cruz",<br>  "role": "adviser"<br>}</pre>OSAAR: <pre>{<br>  "name": "OSAAR Officer",<br>  "role": "osaar"<br>}</pre>Dean: <pre>{<br>  "name": "Dean Maria Santos",<br>  "role": "dean",<br>  "department": "SOIT"<br>}</pre> |
| **PUT** | `/api/v1/admins/signatories/{signatory}` | **Request body** — `name`, `role`, and optional `department` (dean only). The path `{signatory}` is the person id (`adv001` or `SIGNATORY#adv001`). Updates that SIGNATORY item and GSI4 in place, so existing `GSI2` / org desk copies keep working. Unknown id → **404**. Does **not** take `organization_id`, does **not** write `ORGANIZATION.signatories`, and does **not** rewrite past `NOTIFICATION.signatory` snapshots. **Response `200`**. <pre>{<br>  "name": "Prof. Juan Dela Cruz",          ← CHANGE THIS if the person changed<br>  "role": "dean",                          ← CHANGE THIS (adviser \| cdm \| dean \| osaar \| admin)<br>  "department": "SOIT"                     ← CHANGE THIS for deans only<br>}</pre> |
| **DELETE** | `/api/v1/admins/signatories/{signatory}` | **No request body.** Permanently removes the person. Path is the person id (`adv001` or `SIGNATORY#adv001`). **Response `204`**. Unknown id → **404**. **409** if the person still occupies an org desk or has an in-flight submission on their desk (`GSI2`) — detach the desk or clear the queue first. Does **not** rewrite past `NOTIFICATION.signatory` snapshots or Cognito `custom:signatory_id`. |

---

## SAAF create body

Use this as the **POST** `/api/v1/students/submissions` body. For **PUT**, copy it, drop `event_id`, and edit the `← CHANGE THIS` fields listed in the PUT row.

`activity_type` is `co-curricular` or `extra-curricular`. `end_date_of_event` is optional. `date_of_event` must be `YYYY-MM-DD` and at least 10 days from today; otherwise **422**. `collaboration` is optional; `collaboration.dependent_organization_ids` is an array of plain org uuids (each must exist, cannot be the JWT org), and empty/absent means no collaborators.

`activity_details.venue` is stored as sent; the student form offers `Makati Campus` and `Intramuros Campus`. Each `venue_reservation.function_rooms.items[].room_needed` is one of that campus's fixed rooms or `Classroom`. `classroom_name` is sent on a `Classroom` row only and holds that campus's room code — Makati `MPO` + 3 digits (`MPO101`), Intramuros a direction `N`/`W`/`S`/`E`/`NW`/`NE`/`SW`/`SE` + 3 digits (`N101`, `SW204`). The wizard refuses to submit while a `Classroom` row has a missing or off-format code, or a room the venue campus does not offer.

```json
{
  "event_id": "e001",
  "submission_type": "saaf",
  "collaboration": {
    "dependent_organization_ids": ["c3d4"]
  },
  "activity_classification": {
    "activity_type": "extra-curricular",
    "total_org_members": 42
  },
  "proponents": [
    {
      "id": "p001",
      "position_title": "President",
      "first_name": "Nicole",
      "middle_name": "R",
      "last_name": "Santos",
      "suffix": "",
      "student_number": "2021-00123",
      "program_and_year": "BSCS-3",
      "date_of_submission": "2026-09-10",
      "department": "CCIS",
      "position_of_applicant": "President",
      "org_or_course_section": "Mapua Computing Society",
      "contact_number": "09171234567",
      "email_address": "nsantos@mymail.mapua.edu.ph",
      "facebook_link": "fb.com/nicole.santos"
    }
  ],
  "activity_details": {
    "title_and_nature": "Hack Night: Intro to Web Dev",
    "description": "A beginner-friendly hackathon night.",
    "objectives": "Introduce first-year students to web development.",
    "venue": "Intramuros Campus",
    "date_of_event": "2026-10-05",
    "end_date_of_event": "2026-10-05",
    "day_of_event": "Monday",
    "time_of_event": "17:00",
    "expected_participants": 60,
    "individual_contribution": 0,
    "proposed_budget": 5000
  },
  "institutional_alignment": {
    "mission_statements": {
      "competitive": true,
      "research": false,
      "solutions": true
    },
    "core_values_explanation": "Promotes collaboration and innovation.",
    "peo_explanation": "Builds technical competency outside curriculum.",
    "sdg_explanation": "Supports SDG 4: Quality Education."
  },
  "detailed_budget_proposal": {
    "items": [
      {
        "item_no": "1",
        "unit": 1,
        "quantity": 60,
        "price_per_unit": 50,
        "total": 3000
      }
    ],
    "grand_total": 3000
  },
  "venue_reservation": {
    "has_reservation": true,
    "equipment_requested": {
      "items": [
        {
          "name": "Monoblock Chairs",
          "purpose": "Participant seating",
          "remark": "60 units"
        },
        {
          "name": "Tables",
          "purpose": "Workshop tables",
          "remark": ""
        }
      ]
    },
    "function_rooms": {
      "items": [
        {
          "date_needed": "2026-10-05",
          "end_date_needed": "2026-10-05",
          "time_needed": "17:00",
          "end_time_needed": "21:00",
          "room_needed": "Classroom",
          "classroom_name": "N101",
          "remarks": "Workshop room"
        }
      ]
    },
    "audiovisual_equipment": {
      "items": [
        {
          "date_needed": "2026-10-05",
          "end_date_needed": "2026-10-05",
          "time_needed": "17:00",
          "end_time_needed": "21:00",
          "equipment_needed": "Projector",
          "remarks": "1 unit"
        }
      ]
    }
  }
}
```

---

## Session Lifecycle (Any Authenticated Role)

`Authorization: Bearer <Cognito JWT>` — any role

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **POST** | `/api/v1/sessions/start` | Start or resume a session. Returns `sessionId` and `login_time`. |
| **PATCH** | `/api/v1/sessions/{sessionId}/heartbeat` | Extend a session's `last_heartbeat`. Optional body `pages` array. Returns `true` or `409 SESSION_EXPIRED`. |
| **POST** | `/api/v1/sessions/{sessionId}/end` | Terminate a session (logout). Optional body `endReason` (`logout` \| `timeout` \| `tab_closed` \| `expired`). |

**POST /sessions/start — Response `200`:**
```json
{
  "sessionId": "d98f7e2a4b1c...",
  "login_time": "2026-10-09T14:30:00Z",
  "status": "active",
  "isNewSession": true
}
```

---

## Admin / OSAAR Log Monitor

`Authorization: Bearer <Admin, OSAAR, CDM, or CDM Reviewer ID token>`  
Middleware: `cognito.jwt:admin` (allows `admin`, `osaar`, `cdm_reviewer`, `cdm`, and `super_admin` groups)

### Session Log Routes

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **GET** | `/api/v1/admins/monitor/sessions` | Query session logs. Monthly-bucketed via GSI1 (`LOG#SESSION#YYYY-MM`). |
| **GET** | `/api/v1/admins/monitor/sessions/{id}` | Fetch a single session log item by `session_id`. |
| **POST** | `/api/v1/admins/monitor/sessions/{id}/revoke` | Revoke an active session. Body: `{ "reason": "string" }`. |

**GET /admins/monitor/sessions — Query Parameters:**
- `startDate` (`YYYY-MM-DD`, default: today)
- `endDate` (`YYYY-MM-DD`, default: today)
- `userId` (Cognito `sub`, optional)
- `role` (`student` \| `signatory` \| `admin` etc., optional)
- `status` (`active` \| `completed` \| `timed_out` \| `revoked`, optional)
- `limit` (integer, max 200, default 50)
- `nextToken` (opaque cursor, optional)

**Response `200`:**
```json
{
  "data": [
    {
      "session_id": "d98f7e2a4b1c...",
      "sub": "usr_cognito_sub_123",
      "user_name": "Juan Dela Cruz",
      "user_email": "jdelacruz@mymail.mapua.edu.ph",
      "user_role": "student",
      "ip_address": "120.29.74.12",
      "device_info": { "browser": "Chrome", "os": "Windows", "device_type": "desktop" },
      "status": "active",
      "login_time": "2026-10-09T14:30:00Z",
      "logout_time": null,
      "last_heartbeat": "2026-10-09T14:45:00Z",
      "duration_seconds": 900,
      "pages_visited": [
        { "path": "/dashboard", "timestamp": "2026-10-09T14:30:05Z" }
      ],
      "events_count": 1,
      "revocation_reason": null
    }
  ],
  "nextToken": null
}
```

**POST /admins/monitor/sessions/{id}/revoke — Body:**
```json
{ "reason": "suspicious_activity" }
```
**Response `200`:**
```json
{
  "data": {
    "sessionId": "d98f7e2a4b1c...",
    "status": "revoked",
    "revocation_reason": "suspicious_activity"
  }
}
```

### Activity Log Routes

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **GET** | `/api/v1/admins/monitor/activity` | Query activity logs for a date range. |
| **GET** | `/api/v1/admins/monitor/activity/{activityId}` | Fetch a single activity log item. |

### Analytics Routes

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **GET** | `/api/v1/admins/monitor/stats` | Active session count, today's session + activity totals, role distribution. |
| **GET** | `/api/v1/admins/monitor/bottlenecks` | Sessions idle > 30 min but still marked active. |

**GET /admins/monitor/stats — Response `200`:**
```json
{
  "data": {
    "activeSessionsCount": 12,
    "totalSessionsToday": 47,
    "totalActivityToday": 183,
    "roleDistribution": { "student": 30, "signatory": 10, "admin": 7 }
  }
}
```

**GET /admins/monitor/bottlenecks — Response `200`:**
```json
{
  "data": [
    {
      "session_id": "d98f7e2a4b1c...",
      "user_name": "Juan Dela Cruz",
      "user_role": "student",
      "idle_seconds": 2400,
      "last_heartbeat": "2026-10-09T14:10:00Z"
    }
  ]
}
```



**Query Parameters:**
- `startDate` (string, `YYYY-MM-DD`, default: today in Asia/Manila)
- `endDate` (string, `YYYY-MM-DD`, default: today in Asia/Manila)

**Response `200`:**
```json
{
  "activeNow": 4,
  "logins": 28,
  "uniqueUsers": 19,
  "deletes": 2,
  "afterHours": 5,
  "privilegedActions": 12,
  "loginsOverTime": [
    { "bucket": "08:00", "count": 3 },
    { "bucket": "09:00", "count": 8 },
    { "bucket": "10:00", "count": 12 },
    { "bucket": "11:00", "count": 5 }
  ],
  "actionsByType": {
    "CREATE": 14,
    "UPDATE": 8,
    "DELETE": 2
  },
  "alerts": [
    {
      "type": "CONCURRENT_SESSIONS",
      "userName": "Maria Santos",
      "detail": "2+ active sessions detected simultaneously from different IPs (136.158.42.10 and 120.28.194.55)",
      "sessionId": "sess_89a7f10b2c3d4e5f"
    },
    {
      "type": "NEW_IP_LOCATION",
      "userName": "Prof. Alejandro Ramos",
      "detail": "Login detected from unrecognized IP address (180.191.10.22)",
      "sessionId": "sess_11b22c33d44e55f6"
    },
    {
      "type": "LONG_SESSION",
      "userName": "Juan Dela Cruz",
      "detail": "Session has been continuously active for over 9.5 hours",
      "sessionId": "sess_77c88d99e00f11a2"
    },
    {
      "type": "BULK_CHANGES",
      "userName": "Mac Taz (Super Admin)",
      "detail": "5+ deletes performed within a 10-minute window",
      "activityId": "act_102"
    }
  ]
}
```

---

## Session Lifecycle Routes

`Authorization: Bearer <Cognito ID token>` (Any authenticated user group)

| Method | Endpoint | Description | Example JSON |
| :---- | :---- | :---- | :---- |
| **POST** | `/api/v1/sessions/start` | Start a new session or extend an active one. Accepts `deviceId` and `existingSessionId`. Returns `displacedPreviousSession: boolean`. | **Response `200`** <pre>{<br>  "sessionId": "a8f3b...12c",<br>  "login_time": "2026-10-09T23:00:00Z",<br>  "status": "active",<br>  "isNewSession": true,<br>  "displacedPreviousSession": false<br>}</pre> |
| **GET** | `/api/v1/sessions/{sessionId}/validate` | Check if session is still active and not displaced. Returns `200` or `409`. | **Response `200`** <pre>{<br>  "sessionId": "a8f3b...12c",<br>  "status": "active"<br>}</pre> |
| **PATCH** | `/api/v1/sessions/{sessionId}/heartbeat` | Extend active session heartbeat. Returns `409 CONCURRENT_LOGIN_DISPLACED` if displaced, `409 SESSION_REVOKED` if revoked, `409 SESSION_EXPIRED` if stale. | **Request body** <pre>{<br>  "pagesVisited": [<br>    { "path": "/students/dashboard", "pageName": "Dashboard", "timestamp": "2026-10-09T23:01:00Z" }<br>  ]<br>}</pre> **Response `200`** <pre>{<br>  "sessionId": "a8f3b...12c",<br>  "status": "active"<br>}</pre> |
| **POST** | `/api/v1/sessions/{sessionId}/end` | Close a session explicitly (logout or tab_closed) and conditionally remove active pointer. | **Request body** <pre>{<br>  "reason": "logout"<br>}</pre> **Response `200`** <pre>{<br>  "sessionId": "a8f3b...12c",<br>  "status": "completed"<br>}</pre> |

---

## Admin Log Monitoring Routes

`Authorization: Bearer <Admin or OSAAR ID token>`

| Method | Endpoint | Description |
| :---- | :---- | :---- |
| **GET** | `/api/v1/admins/monitor/sessions` | Query session log records filtered by `startDate`, `endDate`, `userId`, `role`, `status`. Returns `{ "data": [...], "nextToken": null }`. |
| **GET** | `/api/v1/admins/monitor/sessions/{id}` | Get detailed session record by session ID. Returns `{ "data": { ... } }`. |
| **POST** | `/api/v1/admins/monitor/sessions/{id}/revoke` | Revoke active user session. Returns `{ "data": { "sessionId": "{id}", "status": "revoked" } }`. |
| **GET** | `/api/v1/admins/monitor/activity` | Query activity log records filtered by `startDate`, `endDate`, `userId`, `role`, `actionType`, `module`. Returns `{ "data": [...], "nextToken": null }`. |
| **GET** | `/api/v1/admins/monitor/activity/{activityId}` | Get detailed activity record. Returns `{ "data": { ... } }`. |
| **GET** | `/api/v1/admins/monitor/stats` | Aggregate session & activity metrics for today. Returns `{ "data": { "activeSessionsCount": N, "totalSessionsToday": N, "totalActivityToday": N, "roleDistribution": { ... } } }`. |
| **GET** | `/api/v1/admins/monitor/bottlenecks` | Identify idle/stale active sessions and potential bottlenecks. Returns `{ "data": [...] }`. |

