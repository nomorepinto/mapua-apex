# Extension TODO — Client Interview Changes (formalized)

Source: client interview notes relayed by Ryan (Nov 6, 2026). Every raw note is
grouped below by the **frontend route** that owns the surface to change, per
[`FRONTEND_ROUTES.md`](routes/FRONTEND_ROUTES.md). A change that needs backend or
DynamoDB work is marked **[backend]** and also lists its frontend display
surface, since the route table above is frontend-only.

Duplicate raw notes (the interview list repeats several items in English
summary form) are merged into one entry each. Client answers from the follow-up
round are folded into the entries and recorded under **Resolved decisions** at
the bottom; the few points still open are under **Still open** — **do not
implement around an assumption without checking one of these first.**

---

## `/students/submissions/saaf` — SAAF wizard

Pages: [`src/routes/students/saaf.tsx`](../mapua-apex-frontend/src/routes/students/saaf.tsx)
+ the sections in
[`src/components/submission/`](../mapua-apex-frontend/src/components/submission/)
rendered by
[`src/components/students/saaf/saaf-steps.tsx`](../mapua-apex-frontend/src/components/students/saaf/saaf-steps.tsx).

### S-1. Terms & Conditions gate replaces the pre-submit instructions **[frontend + backend]**
Raw notes: *"instructions before submit forms"* · *"tick box na lahat ng disclaimers
before everything dapat understand niya"* · *"replace instructions with terms and
conditions, add average turn around time"* · *"terms and conditions update"* ·
*"add minor major to terms and conditions"*.

- Replace the current instructions surface ([`how-it-works.tsx`](../mapua-apex-frontend/src/components/submission/how-it-works.tsx),
  opened from the Guide dialog in
  [`submission-guide.tsx`](../mapua-apex-frontend/src/components/students/submissions/submission-guide.tsx))
  with a **Terms & Conditions** block shown before submission.
- The T&C must state the **average turnaround time (2–3 working days)** and the
  filing window (**7:00 AM – 3:00 PM**, confirmed).
- The T&C must include the **major / minor event** criteria (client decision
  **RD-8**): a sentence (or short list) stating **what qualifies an event as a
  major vs a minor event**. This is definitional T&C text only — not a proponent
  field. Exact criteria wording to be supplied by the client.
- Every disclaimer is an **explicit tick-to-acknowledge** item; Submit stays
  disabled until all boxes are checked (i.e. add the acknowledgment flags to
  [`validate-saaf-step.ts`](../mapua-apex-frontend/src/components/submission/validate-saaf-step.ts)
  and to the `formComplete` gate in
  [`saaf-context.tsx`](../mapua-apex-frontend/src/components/students/saaf/saaf-context.tsx)).
- The T&C text itself has to be stored versioned per submission so "the student
  agreed to version X on date Y" is provable **[backend]**.

### S-2. Activity type: beyond extra-/co-curricular **[frontend + backend]**
Raw notes: *"dapat ticked kung ano ring kind of event siya, aside from extra
curricular / co curricular"* · *"dapat kasama if selling activity siya"* ·
*"fund raising/charity activity"* · *"add booth option selling activity to saaf 4"* ·
*"add fundraising option to saaf 4"*.

- [`activity-classification-section.tsx`](../mapua-apex-frontend/src/components/submission/activity-classification-section.tsx)
  currently offers exactly two radios (`co-curricular` / `extra-curricular`) in a
  **single-select**. Add the missing natures as **additional, tickable** values:
  - **Selling activity** (booth / concession);
  - **Fund-raising / charity activity**.
- Because an event can be *both* extra-curricular *and* a selling activity, this
  stops being one radio group: keep co/extra-curricular as the classification and
  add a separate multi-select "nature of activity" (selling / fundraising /
  none). Persist the new fields in
  [`dynamodb-adapters.ts` `buildSaafApiPayload`](../mapua-apex-frontend/src/lib/dynamodb-adapters.ts)
  (currently hardcodes `activity_type: saafDraft.activityType || "extra-curricular"`)
  **[backend]** — the SUBMISSION item needs the extra attributes and the enum
  must accept them.
- Selecting **selling / fundraising** is what reveals the rental-fee note (S-3)
  and the non-Mapúa payment note (S-8).

### S-3. Booth + concessionaire **rental charge** warning and budget line **[frontend]**
Raw notes: *"dapat may rental charge ang booth + concessionaries"* · *"dapat may
note ito or warning"* · *"bill add rental charges for booth"*.

- When the activity involves a **booth / concessionaire setup**, show a
  warning/note that a **rental charge applies**, in
  [`activity-details-section.tsx`](../mapua-apex-frontend/src/components/submission/activity-details-section.tsx)
  (the step-4 "Activity" panel) and again in
  [`budget-proposal-section.tsx`](../mapua-apex-frontend/src/components/submission/budget-proposal-section.tsx).
- Add a predefined budget line item (or an "Add rental charge" quick-add button)
  for the booth/concession rental so it cannot be forgotten in the bill.
- **Ask the client how the rental / non-Mapúa payments actually work** — rate,
  who collects, and how it is settled (see **Still open**, Q-A). The form should
  flag the charge and record it, but the amount/payee logic is not yet specified.
  Concessionaires already exist as a funding source
  ([`funding-sources.ts`](../mapua-apex-frontend/src/constants/funding-sources.ts))
  — reuse that vocabulary rather than adding a second term.

### S-4. Turnaround-time (TAT) printed on the form — T&C text only **[frontend]**
Raw notes: *"included dapat sa forms ung TAT ng responses nila, 2-3 working days
ang standard"* · *"start 8am, cutoff 3pm, proposals submitted after 3pm ang
working days ay start na bukas"*.

- Show the **standard response TAT (2–3 working days)** and the filing window
  (**7:00 AM – 3:00 PM**) on the form itself (header/footer of the wizard and
  inside the S-1 T&C block), not only in the guide.
- The **3:00 PM cutoff rule** (a filing after 3 PM starts its working-day clock
  tomorrow) is **communicated in the T&C text only** — it is **not** enforced or
  computed in code (client decision **RD-6**). No due-date math, no inline "you
  are past the cutoff" note; the T&C sentence carries it.

### S-5. On-campus / off-campus — and off-campus skips CDM **[frontend + backend]**
Raw notes: *"dapat nakalagay whether off or on campus ang event"* · *"skip ang
cdmo kapag off campus kasi wala na sa scope nila"* · *"on campus, off campus"*.

- Add a required **Location: On-campus / Off-campus** choice to the Activity
  step ([`activity-details-section.tsx`](../mapua-apex-frontend/src/components/submission/activity-details-section.tsx))
  and persist it on the SUBMISSION **[backend]**.
- **Off-campus** must:
  - hide/skip the Reservation step's room holds and the CDM (CDMO) desk in the
    chain — facilities are out of CDM's scope — driven from the approval chain,
    not from a hardcoded role list;
  - still be reviewable by OSAAR/adviser/dean.
- The chain-skipping itself is **[backend]** (stage selection at submission
  creation, [`approval-stages`](../mapua-apex-frontend/src/routes/osaar/approval-stages.tsx)
  only orders the OSAAR stages today). Frontend: the tracker/timeline must not
  render a CDM desk that was never entered (see D-1, R-2).

### S-6. Event participants: Mapúa vs non-Mapúa, payment for non-Mapúa **[frontend + backend]**
Raw note: *"event participants should mapuan or non mapuan, payment req for non
Mapuan"*.

- Split the headcount in the Classification step
  ([`activity-classification-section.tsx`](../mapua-apex-frontend/src/components/submission/activity-classification-section.tsx),
  currently one `totalOrgMembers` field with a 30–3000 bound) into **Mapúa** and
  **non-Mapúa** participant counts.
- When **non-Mapúa** participants > 0, show the note that a **payment requirement
  applies** to them. Amount/payee not yet specified — **ask the client how the
  payment works** (see **Still open**, Q-A).
- Persist both counts + the flag **[backend]**; the room-suggestion capacity
  ([`reservable-capacity.ts`](../mapua-apex-frontend/src/lib/reservable-capacity.ts))
  should keep reading the **total**.

### S-7. Campus added to proponent details **[frontend + backend]**
Raw note: *"add campus to proponent details"*.

- Add a **Campus** field to
  [`proponent-card.tsx`](../mapua-apex-frontend/src/components/submission/proponent-card.tsx)
  (proponents already carry `department` via `departmentValues`), populated from
  the campus master data maintained at `/osaar/setup/campuses`.
- Store per proponent **[backend]** (`proponents[]` entries in
  `buildSaafApiPayload`), and show it back in the reviewer detail views.

### S-8. Equipment is room-specific; bringing equipment needs a warning **[frontend + backend]**
Raw notes: *"equipment should be room specific"* · *"outside equipment, drone,
cars, etc add options for reserving events"* · *"checkboxes: add warning for
bringing equipment"*.

- In the Reservation step ([`reservation-form.tsx`](../mapua-apex-frontend/src/components/students/reservations/reservation-form.tsx)),
  the equipment pick must be **filtered by the room(s) already selected** — the
  equipment list has to be attached to rooms on the reservable model **[backend]**
  (today a reservable is only `room` | `equipment`, see
  [`types.ts` `ReservableType`](../mapua-apex-frontend/src/lib/types.ts) — there is
  no room↔equipment relation).
- Add an **"outside / non-reservable equipment"** free-list option (drones, cars,
  audio rigs brought in by the org, etc.) as its own reservation sub-section, so
  the approval desks see what enters the building.
- Checking **any** equipment (reserved or outside) raises a **warning** about
  bringing equipment into campus facilities (responsibility/inspection/return
  conditions). Warning must be acknowledged, linking into the S-1 disclaimer set.

### S-9. Classroom check must precede the other property settings **[frontend]**
Raw note: *"is classroom check should appear before setting other properties"*.

- In the Reservation step, the **room-vs-classroom** determination (the
  `is_classroom` / classroom-name-format branch, cf.
  [`types.ts`](../mapua-apex-frontend/src/lib/types.ts) `classroom_name_prefixes`,
  `classroom_name_digits`, `is_classroom`) currently sits with the rest of the
  room properties. Move it **upstream**: pick the room kind first, then reveal
  the properties that only apply to that kind (classroom code format vs. function
  room slot/capacity fields), so an impossible combination cannot be entered.

---

## `/students/dashboard` — student org dashboard

Pages: [`src/routes/students/dashboard.tsx`](../mapua-apex-frontend/src/routes/students/dashboard.tsx),
[`SubmissionTrackerModal.tsx`](../mapua-apex-frontend/src/components/org/SubmissionTrackerModal.tsx).

### D-1. Milestone modal: turnaround time + elapsed hours before approval **[frontend + backend]**
Raw notes: *"note turnaround time sa milestones"* · *"tapos timestamp kung ilang
oras nagtake bago maapprove"* · *"add turn around time to milestone modal, add
hours before approved"*.

- The **"Milestone & Progress"** tab
  ([`SubmissionTrackerModal.tsx` L248](../mapua-apex-frontend/src/components/org/SubmissionTrackerModal.tsx))
  gains, per stage: the **expected TAT** for that stage and the **actual elapsed
  time** (hours, and days/hours when > 24 h) between entering the desk and being
  acted on.
- Requires persisted per-stage `entered_at` / `acted_at` timestamps on the
  submission **[backend]** (the activity log already records the actions, but the
  tracker reads the submission record, so add the durations to the chain DTO).
- Show the same elapsed time next to the decision in the submission cards
  ([`submissions-panel.tsx`](../mapua-apex-frontend/src/components/students/dashboard/submissions-panel.tsx),
  [`student-calendar-card.tsx`](../mapua-apex-frontend/src/components/students/dashboard/student-calendar-card.tsx))
  where the paper is already decided.

### D-2. Document ID shown as sequential SAAF-#### **[frontend + backend]**
Raw notes: *"change ang document id to be sequential saaf-id, siguro gamitin na
lang timestamp for that"* · *"palitan din apex"* (apex-side display too).

- Replace the current display code — first 8 hex chars of the UUID,
  [`formatDocumentId`](../mapua-apex-frontend/src/lib/dynamodb-adapters.ts) (`SAAF-1289C970`)
  — with a **sequential, human-readable document number** (`SAAF-0001`, `SAAF-0002`, …).
- Recommended mechanism (client suggested a timestamp): a **timestamp-derived**
  sequence, e.g. `SAAF-YYMMDD-###` from a per-day atomic counter, or a monotonic
  counter item on the shared table (`PK = SK = COUNTER#SAAF`) incremented with
  `ADD` on submission creation **[backend]**. A raw timestamp alone is not
  sequential and collides for same-second submissions — pick the counter, keep
  the UUID as the internal key.
- **All** call sites must change together (they all import `formatDocumentId`):
  student submissions panel / calendar / tracker, the OSAAR + adviser + dean +
  CDM desks ([`activity-row.tsx`](../mapua-apex-frontend/src/components/ui/activity-row.tsx),
  [`use-review-dashboard.ts`](../mapua-apex-frontend/src/hooks/use-review-dashboard.ts)),
  announcements dialog, post-eval IDs (`POST` prefix), signatory IDs (`SIG`
  prefix), PDF output ([`save-proposal-pdf.ts`](../mapua-apex-frontend/src/lib/save-proposal-pdf.ts),
  [`pdf-generator.ts`](../mapua-apex-frontend/src/lib/pdf-generator.ts)), and the
  reports/exports.
- Note the shared-table caveat: the counter lives on the `mapua-apex` table also
  written by the arcus apps — one writer only (the submission-creation path).

---

## `/cdm/dashboard` · `/dean/dashboard` · `/adviser/dashboard` · `/osaar/dashboard/review` — reviewer desks

Shared desk code: [`src/components/dashboard/submissions/`](../mapua-apex-frontend/src/components/dashboard/submissions/)
(one `SubmissionDesk` for all four, per the shared-desk architecture).

### R-1. "Approve" button text is exclusive to the campus OSAAR desk; every other desk says "Review" **[frontend]**
Raw notes: *"kay sir oli lang ang APPROVED"* · *"if si sir kyle nag approve ang
label ay REVIEWED"* · *"other osaars should not have approve title"*.

- Client decision (**RD-9**): the authority is tied to the **desk/role**, not the
  person. Concretely this is a **button-label change**, not a status model:
  - the **campus OSAAR** desk's action button is the only one labelled
    **"Approve"** (its outcome badge is **APPROVED**);
  - **every other signatory desk** — adviser, dean, CDM, and all non-campus-
    OSAAR accounts — uses the **"Review"** button label and the **REVIEWED**
    outcome wording.
- Implementation: the decision/action cell is selected by `ActivityRow`'s
  `statusField`/role in
  [`activity-row.tsx`](../mapua-apex-frontend/src/components/ui/activity-row.tsx)
  and the desk shell in
  [`src/components/dashboard/submissions/`](../mapua-apex-frontend/src/components/dashboard/submissions/)
  — gate the label on the **desk/role** the current user is acting as. Do **not**
  hardcode person names or account IDs.
- The underlying status value stays whatever it is today (approved/under_review/
  etc.); only the **verb shown to the acting signatory** changes per desk. If the
  backend currently records a distinct "approved" event only from the campus
  OSAAR desk, that is already correct — verify, but no schema change is expected
  here.
- Related surfaces that echo the verb: tracker timeline (D-1 modal), PDF/export
  wording.

### R-2. Signatory names/titles corrected **[data — DEFERRED]**
Raw notes: *"maam eira (tama ba spelling) at sir bobet"* · *"John Benedict"* ·
*"Anna beh / Ana"* · *"Eira yung kasama ko sa sokor"* · *"maam anna at sir bobet"* ·
*"turnaround time lang ng cdm sana ung logs, sa osaar overall na"*.

- **Name/spelling edits are deferred** (client decision **RD-4** — "ignore this
  for now"). Do not touch the signatory records until the client confirms each
  spelling.
- When it is picked up: these are **record values, not code** — correct them on
  `/osaar/setup/signatories` (and mirror into the PDF signature blocks), so the
  fix propagates without a deploy.
- **Not deferred** — the TAT **label** wording in the same note stands: **CDM**
  turnaround is measured per-desk from its own logs, while **OSAAR** is reported
  as the **overall** turnaround. Reflect this in the metric labels on the desks
  and on `/admin/reports` (see A-3).

---

## `/osaar/dashboard/submissions` · `/osaar/reports` — OSAAR overall

### O-OSAAR-1. Filing lead time: **10 calendar days** before the event — T&C wording only **[frontend]**
Raw note: *"osaar should be able to send 10 days before"*.

- The 10-day minimum event-date lead is **already implemented and enforced in
  code** — `EVENT_DATE_MIN_LEAD_DAYS = 10`
  ([`date-key.ts`](../mapua-apex-frontend/src/lib/date-key.ts)) on the frontend,
  mirrored by the backend
  ([`event-date.ts`](../mapua-apex-backend-nest/src/common/event-date.ts),
  `The date of event must be at least 10 days from today.`), shown inline in
  [`activity-details-section.tsx` L350](../mapua-apex-frontend/src/components/submission/activity-details-section.tsx).
  **No enforcement change is needed.**
- The only change here: state the rule in the **S-1 Terms & Conditions** as **10
  calendar days** (client decision **RD-10** — calendar, not working days),
  and confirm the day-type label matches the existing code, which counts
  **Manila calendar days** (see `event-date.spec.ts`).
- The **3 PM cutoff is irrelevant to this count** (RD-6): it is T&C text only and
  never feeds the lead-time math.
- Related deferred item 6 in [`todo.md`](todo.md) (term window / blackout dates):
  different rule, same date-validation neighbourhood — keep the two checks
  adjacent, not duplicated.

### O-OSAAR-2. OSAAR can view the activity **and session** log pages **[frontend + backend]**
Raw note: *"osaar should be able to view activity and session logs page"*.

- **Activity log is already available to OSAAR**: `osaar` is in
  `ACTIVITY_LOG_GROUPS` and the `/osaar/activities` page exists
  ([`FRONTEND_ROUTES.md`](routes/FRONTEND_ROUTES.md)).
- **Session log is not**: `osaar` is **missing from `SESSION_LOG_GROUPS`**
  (currently `["admin"]`,
  [`constants/auth.ts`](../mapua-apex-frontend/src/constants/auth.ts)) and there is
  **no `/osaar/sessions` route**.
- Change: add `"osaar"` to `SESSION_LOG_GROUPS`, mount a `/osaar/sessions` route
  that reuses `AdminMonitorSessionsPage`
  ([`monitor-sessions.tsx`](../mapua-apex-frontend/src/routes/admin/monitor-sessions.tsx))
  wrapped in `AuthGuard`, exactly as `/osaar/activities` reuses the activity
  page, and surface it in the OSAAR sidebar
  ([`osaar-layout.tsx`](../mapua-apex-frontend/src/routes/layouts/osaar-layout.tsx))
  + `page-names.ts`.
- **[backend]** the session-log read endpoint is gated to the `session_admin`
  role — that gate must also accept the OSAAR role, or OSAAR will pass the
  frontend guard and still get 403s. Keep the two gates consistent.
- Note the Reports & Export page already hides the **Session log report type**
  from callers outside `SESSION_LOG_GROUPS`; once OSAAR joins that group, decide
  whether OSAAR should also gain that report *type* on `/osaar/reports` (A-3) or
  only the raw session-log *viewer*.

---

## `/cdm/reservables` (and the same page mounted at the admin reservables desk)

Page: [`src/routes/cdm-reviewer/reservables.tsx`](../mapua-apex-frontend/src/routes/cdm-reviewer/reservables.tsx).

### C-1. Room types: function room, classroom, multi-purpose hall, open spaces, laboratories **[frontend + backend]**
Raw note: *"add room type: function room, classroom, multi purpose hall, open
spaces, laboratories"*.

- Today a reservable is only typed `room | equipment`
  ([`types.ts` `ReservableType`](../mapua-apex-frontend/src/lib/types.ts)), and the
  UI infers "Classroom" vs "Function Room" from the name at render time
  ([`cdm-calendar-section.tsx` L336-360](../mapua-apex-frontend/src/components/signatories/dashboard/cdm-calendar-section.tsx)).
- Add a first-class **room subtype** enum with the five values above on the
  reservable record **[backend]**, editable on the Add/View reservable forms and
  in CSV import ([`parse-csv.ts` `RESERVABLE_TYPE_ALIASES`](../mapua-apex-frontend/src/lib/parse-csv.ts)),
  then replace the name-sniffing in the calendar/table with the stored subtype.
- Subtype drives S-8 (room-specific equipment) and S-9 (classroom check ordering).

---

## `/admin/reports` · `/admin/activities` (and the reused OSAAR/CDM activity log)

Pages: [`reports-export.tsx`](../mapua-apex-frontend/src/routes/reports/reports-export.tsx),
[`monitor-activities.tsx`](../mapua-apex-frontend/src/routes/admin/monitor-activities.tsx).

### A-3. Turnaround-time metrics in reports **[backend + frontend]**
Raw notes: *"turnaround time lang ng cdm sana ung logs, sa osaar overall na"*.

- Proposal report gains: per-desk duration (CDM from its own action logs) and an
  **overall** submission turnaround for OSAAR; median is already computed
  (`median_duration_minutes`,
  [`reporting.ts`](../mapua-apex-frontend/src/lib/reporting.ts)) — extend with
  per-stage breakdown and export columns.

### A-4. Data Privacy Act disclaimer / consent **[frontend + backend]**
Raw note: *"data privacy act disclaimer - pwedeng magamit yung data nila sa
relevant facilities"*.

- Add a **Data Privacy Act of 2012 (RA 10173)** consent statement to the S-1
  T&C set (its own checkbox): the proponent's and the listed participants' data
  may be processed and shared with the relevant campus offices/facilities for the
  purpose of evaluating and running the approved activity.
- Consent must be recorded per submission (text version + timestamp) **[backend]**
  and viewable in the admin/OSAAR detail and the export.
- **We draft the notice** (client decision **RD-7**) for their legal review; no
  approved university text is supplied.

---

## Out of scope for the mapua-apex route table (recorded so the note is not lost)

- **"palitan din apex"** — **DEFERRED** (client decision **RD-3** — "ignore this
  for now"). The rename would also touch the arcus companion apps
  (`arcus-attendance-system`, `arcus-evaluation-system`), which live outside this
  route table. Revisit with Ryan when it is picked up.

---

## Resolved decisions (client follow-up round)

- **RD-1 — Filing window**: **7:00 AM – 3:00 PM** is official (the "8 AM" note is
  superseded). Applied in S-1, S-4.
- **RD-2 — Standard TAT**: **2–3 working days** is the promise. Applied in S-1,
  S-4, and the D-1 milestone target.
- **RD-3 — "palitan din apex"**: ignore for now (see Out of scope).
- **RD-4 — Signatory names/spellings**: ignore for now; deferred in R-2.
- **RD-5 — Booth / non-Mapúa payments**: still **awaiting the client** — we have
  not yet been told how the rental / payment works. Amount logic stays blocked
  (see **Q-A**); the warning/note in S-3, S-6 is not blocked.
- **RD-6 — 3 PM cutoff**: **not enforced in code**, only stated in the Terms &
  Conditions. No due-date math, no inline cutoff warning, and it does not affect
  the 10-day lead-time count. Applied in S-4, O-OSAAR-1.
- **RD-7 — Data Privacy Act notice**: **we draft** the RA 10173 consent text for
  the client's legal review. Applied in A-4.
- **RD-8 — Major / minor event**: "add minor major to terms and conditions" means
  the **criteria for what makes an event major vs minor**, added as **definitional
  T&C text** (not a proponent field). Applied in S-1.
- **RD-9 — APPROVED vs REVIEWED**: authority is the **desk/role**, and it is
  realised as a **button-label change** — only the **campus OSAAR** desk shows
  "Approve", every other signatory desk shows "Review". Applied in R-1.
- **RD-10 — 10-day lead time**: **calendar days**, and the rule is **already
  enforced in code** — the change is only to state it in the T&C. Applied in
  O-OSAAR-1.
- **RD-11 — OSAAR log access**: OSAAR must be able to view the **activity and
  session** log pages. Activity is already open to OSAAR; session needs the
  `SESSION_LOG_GROUPS` entry, a `/osaar/sessions` route, and the matching backend
  role gate. Applied in O-OSAAR-2.

---

## Still open

- **Q-A (RD-5)** — How do the booth/concession **rental** and **non-Mapúa
  participant** payments actually work: rate, who collects, how the form should
  record it? **We are still going to ask the client.** Blocks the money-handling
  part of S-3 and S-6; the warning/note itself is not blocked.
