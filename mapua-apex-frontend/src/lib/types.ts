// ─── DynamoDB Entity Types ───────────────────────────────────────────────────
// Mapped from the APEX DynamoDB single-table design.
// PK/SK/GSI fields are included for reference but will typically be
// constructed by the API layer rather than consumed by UI components.

// ─── Organization ────────────────────────────────────────────────────────────

export interface Organization {
  /** PK = `ORGANIZATION#<uuid>` */
  PK: string
  /** SK = `ORGANIZATION#<uuid>` (same as PK for root item) */
  SK: string
  name: string
}

// ─── Event ───────────────────────────────────────────────────────────────────

export interface Event {
  /** PK = `EVENT#<uuid>` */
  PK: string
  /** SK = `EVENT#<uuid>` */
  SK: string
  sent_at: string
  /** GSI1PK = `ORGANIZATION#<uuid>` — submitted by which org */
  GSI1PK: string
  /** GSI1SK = timestamp */
  GSI1SK: string
}

// ─── Submission (SAAF) ───────────────────────────────────────────────────────

export type ActivityType = "co-curricular" | "extra-curricular"

export interface Proponent {
  id: string
  position_title: string
  first_name: string
  middle_name: string
  last_name: string
  suffix: string
  student_number: string
  program_and_year: string
  date_of_submission: string
  department: string
  position_of_applicant: string
  org_or_course_section: string
  contact_number: string
  email_address: string
  facebook_link: string
}

export interface ActivityClassification {
  activity_type: ActivityType
  total_org_members: number
}

export interface ActivityDetails {
  title_and_nature: string
  description: string
  objectives: string
  venue: string
  date_of_event: string
  day_of_event: string
  time_of_event: string
  expected_participants: number
  individual_contribution: number
  proposed_budget: number
}

export interface MissionStatements {
  competitive: boolean
  research: boolean
  solutions: boolean
}

export interface InstitutionalAlignment {
  mission_statements: MissionStatements
  core_values_explanation: string
  peo_explanation?: string | null
  sdg_explanation: string
}

export interface BudgetItem {
  item_no: string
  /** Free-text measuring unit ("pc", "box", …); legacy rows stored a number. */
  unit: number | string
  quantity: number
  price_per_unit: number
  total: number
}

export interface DetailedBudgetProposal {
  items: BudgetItem[]
  grand_total: number
}

// ─── Room Reservation (Campus / Reservable / Booking) ────────────────────────
// Mirrors the backend DynamoDB CAMPUS / RESERVABLE / BOOKING objects and the
// canonical 6-day x 12-slot weekly schedule. Slot math lives in
// `lib/schedule-slots.ts` and matches backend `ReservableSchedule.php`.

/** Weekday columns of a reservable's weekly template. Sunday is never reservable. */
export type ReservableDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"

/** A reservable's weekly availability template: each day maps to 12 booleans (slot available?). */
export type ReservableSchedule = Record<ReservableDay, boolean[]>

export type ReservableType = "room" | "equipment"

/** One concrete date plus the 70-minute slot indices (0..11) selected on it. */
export interface SlotSelection {
  /** `YYYY-MM-DD` */
  date: string
  slots: number[]
}

export interface ApiCampus {
  campus_id: string
  name: string
  /** Allowed classroom-name prefix tokens; [] when the campus defines no naming rule. */
  classroom_name_prefixes?: string[]
  /** Required digit count for classroom names; null when no naming rule. */
  classroom_name_digits?: number | null
  /** Pre-formatted naming note from the API (e.g. "MPO / NW / N followed by exactly 3 digits"). */
  classroom_name_hint?: string | null
}

/** Participant bounds carried on a pick so the SAAF step can enforce them offline. */
export interface ReservableCapacityFields {
  /** Room-only participant bounds; null when unstated (equipment is always null). */
  min_participants?: number | null
  max_participants?: number | null
}

export interface ApiReservable extends ReservableCapacityFields {
  reservable_id: string
  campus_id: string
  name: string
  type: ReservableType
  schedule: ReservableSchedule
  /** Pre-formatted capacity note from the API (e.g. "between 50 and 100 participants"). */
  capacity_label?: string | null
  /** Room-only flag; true when the room must match the campus classroom name format. */
  is_classroom?: boolean
}

/** Per-date availability for one reservable, as returned by the availability endpoint. */
export interface ApiAvailabilityDate {
  booked_slots: number[]
  available_slots: number[]
}

export interface ApiAvailability {
  reservable_id: string
  campus_id: string
  name: string
  type: ReservableType
  schedule: ReservableSchedule
  /** Keyed by `YYYY-MM-DD`. Dates outside the queried window are absent. */
  dates: Record<string, ApiAvailabilityDate>
}

export type BookingSource = "submission" | "cdm"

export interface ApiBooking {
  booking_id: string
  reservable_id: string
  reservable_name: string
  reservable_type: ReservableType
  campus_id: string
  source: BookingSource
  timestamp: string
  schedule_selected: SlotSelection[]
  /** CDM manual bookings only. */
  reason?: string | null
  booked_by?: string | null
  /** Submission-sourced bookings only. */
  organization_id?: string | null
  submission_id?: string | null
  event_id?: string | null
}

/** A reservable picked in the SAAF venue reservation, with its date+slot selections. */
export interface VenueReservationPick extends ReservableCapacityFields {
  reservable_id: string
  campus_id: string
  name: string
  type: ReservableType
  selections: SlotSelection[]
  remarks?: string
}

export interface VenueReservation {
  has_reservation: boolean
  reservations: VenueReservationPick[]
}

export type CreateCampusPayload = {
  name: string
  classroom_name_prefixes?: string[]
  classroom_name_digits?: number | null
}

export type CreateReservablePayload = ReservableCapacityFields & {
  name: string
  type: ReservableType
  schedule: ReservableSchedule
  is_classroom?: boolean
}

export type CreateBookingPayload = {
  selections: SlotSelection[]
  reason?: string
}

// ─── Reservation Change Requests ─────────────────────────────────────────────
// A student asks CDM to cancel or reschedule the holds on an approved paper;
// CDM resolves it. Mirrors the backend RESERVATION_CHANGE object and the
// `ReservationChangeResource` projection.

export type ReservationChangeStatus = "pending" | "resolved" | "denied"
export type ReservationChangeRequestType = "cancel" | "reschedule"
export type ReservationChangeDecision = "cancel" | "reschedule" | "deny"
/** Per-hold instruction CDM sends when rescheduling. */
export type ReservationChangeAction = "keep" | "update" | "swap"
/** What the resolution actually did to a hold, recorded in the audit trail. */
export type AppliedBookingAction = "released" | "kept" | "updated" | "replaced"

/** One hold the request targets, frozen at request time. */
export interface ReservationChangeBooking {
  pk: string
  sk: string
  reservable_id: string | null
  reservable_name: string | null
  reservable_type: ReservableType | null
  schedule_selected: SlotSelection[]
}

export interface AppliedHoldSnapshot {
  reservable_id: string | null
  schedule_selected: SlotSelection[]
}

export interface AppliedBookingEntry {
  pk: string
  sk: string
  action: AppliedBookingAction
  before: AppliedHoldSnapshot | null
  after: AppliedHoldSnapshot | null
  /** Room swaps only: the recreated booking's keys. */
  new_pk?: string | null
  new_sk?: string | null
}

export interface AppliedSubmissionEntry {
  status_before: string | null
  status_after: string | null
  date_of_event_before?: string | null
  date_of_event_after?: string | null
  time_of_event_before?: string | null
  time_of_event_after?: string | null
  booking_refs_before?: Array<{ pk: string; sk: string }>
  booking_refs_after?: Array<{ pk: string; sk: string }>
}

export interface ReservationChangeApplied {
  bookings: AppliedBookingEntry[]
  submission: AppliedSubmissionEntry | null
}

/** The lean submission snapshot the CDM detail panel renders. */
export interface ReservationChangeSubmission {
  submission_id?: string | null
  status?: string | null
  organization_name?: string | null
  activity_details?: {
    title_and_nature?: string | null
    venue?: string | null
    date_of_event?: string | null
    day_of_event?: string | null
    time_of_event?: string | null
    expected_participants?: number | null
  } | null
  venue_reservation?: {
    has_reservation?: boolean
    reservations?: Array<{
      reservable_id?: string
      campus_id?: string
      name?: string
      type?: ReservableType
      selections?: SlotSelection[]
      remarks?: string | null
    }>
  } | null
}

export interface ApiReservationChange {
  change_id: string | null
  event_id: string | null
  submission_id: string | null
  organization_id: string | null
  campus_id: string | null
  requested_by: string | null
  requested_at: string | null
  request_type: ReservationChangeRequestType | null
  reason: string | null
  suggested_date: string | null
  status: ReservationChangeStatus | null
  bookings: ReservationChangeBooking[]
  decision: ReservationChangeDecision | null
  resolved_by: string | null
  resolved_at: string | null
  comment: string | null
  applied?: ReservationChangeApplied | null
  /** Denormalized for the CDM list; present only when context rode along. */
  event_title?: string | null
  organization_name?: string | null
  submission?: ReservationChangeSubmission | null
}

export interface StoreReservationChangePayload {
  request_type: ReservationChangeRequestType
  reason: string
  suggested_date?: string | null
}

export interface ResolveBookingInstruction {
  pk: string
  sk: string
  action: ReservationChangeAction
  selections?: SlotSelection[]
  new_reservable_id?: string | null
}

export interface ResolveReservationChangePayload {
  decision: ReservationChangeDecision
  comment?: string
  bookings?: ResolveBookingInstruction[]
}

export interface Submission {
  /** PK = `EVENT#<uuid>` */
  PK: string
  /** SK = `SUBMISSION#<uuid>` */
  SK: string
  submission_type: "saaf"
  sent_at: string
  activity_classification: ActivityClassification
  proponents: Proponent[]
  activity_details: ActivityDetails
  institutional_alignment: InstitutionalAlignment
  detailed_budget_proposal: DetailedBudgetProposal
  venue_reservation: VenueReservation
  status: "pending" | "approved" | "denied" | "returned" | "cancelled"
  /** UUID of the signatory who currently needs to act on this */
  current_signatory: string
  /** Ordered snapshot of signatory UUIDs resolved at submit time (plain ids, no `SIGNATORY#` prefix) */
  signatory_sequence?: string[]
  /** Collaboration dependents chosen by the proponent (plain ids, no `ORGANIZATION#` prefix) */
  collaboration?: {
    dependent_organization_ids?: string[]
  }
  /** Proponent vs collaboration-dependent view for the caller. */
  role?: "proponent" | "dependent"
  /** GSI2PK = `SIGNATORY#<uuid>` — present while pending or returned */
  GSI2PK?: string
  /** GSI2SK = timestamp */
  GSI2SK?: string
}

// ─── Notification ────────────────────────────────────────────────────────────

export type NotificationType = "approved" | "fully approved" | "denied" | "returned"

export interface Notification {
  /** PK = `SUBMISSION#<uuid>` */
  PK: string
  /** SK = `NOTIFICATION#<timestamp>` */
  SK: string
  signatory: string
  notif_type: NotificationType
  /** Mandatory when notif_type is denied or returned */
  comment?: string
}

// ─── Signatory ───────────────────────────────────────────────────────────────

export interface Signatory {
  /** PK = `SIGNATORY#<uuid>` */
  PK: string
  /** SK = `SIGNATORY#<uuid>` */
  SK: string
  name: string
  /** GSI4PK = role key, e.g. "ROLE#DEAN", "ROLE#ADVISER#ORG#<orgUuid>" */
  GSI4PK: string
  /** GSI4SK = signatory_uuid */
  GSI4SK: string
}

// ─── Deadline Reminder ───────────────────────────────────────────────────────

export interface DeadlineReminder {
  /** PK = `EVENT#<uuid>` */
  PK: string
  /** SK = `DEADLINE#<uuid>` */
  SK: string
  sent_at: string
  deadline: string
}

// ─── Admin Panel View Models ─────────────────────────────────────────────────
// Derived types used by the admin-osa-panel route. These flatten DynamoDB
// relationships into display-ready shapes.

export type OrgStatus = "Active" | "Pending Registration" | "Inactive"

export interface OrgAccountView {
  /** Organization UUID */
  id: string
  name: string
  /** Resolved signatory name for the org adviser */
  adviser: string
  /** Resolved proponent name acting as representative */
  representative: string
  status: OrgStatus
}

export interface Announcement {
  id: string
  title: string
  date: string
  time: string
}

export interface InstitutionMetrics {
  activeOrganizations: number
  activeOrganizationsChange: string
  totalActiveSubmissions: number
  totalActiveSubmissionsNote: string
  approvalSlaRate: number
  approvalSlaTurnaround: string
}
