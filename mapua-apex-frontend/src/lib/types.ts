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
  peo_explanation: string
  sdg_explanation: string
}

export interface BudgetItem {
  item_no: string
  unit: number
  quantity: number
  price_per_unit: number
  total: number
}

export interface DetailedBudgetProposal {
  items: BudgetItem[]
  grand_total: number
}

export interface EquipmentRequested {
  monoblock_chairs: boolean
  whiteboards: boolean
  tables: boolean
  rostrum: boolean
  flags_with_stand: boolean
  panel_boards: boolean
  others_specified: string
}

export interface GeneralFacilityItem {
  item: string
  date_of_use: string
  time_of_use: string
  location: string
}

export interface FunctionRoomItem {
  date_needed: string
  time_needed: string
  room_needed: string
  remarks: string
}

export interface AudiovisualItem {
  date_needed: string
  time_needed: string
  equipment_needed: string
  remarks: string
}

export interface VenueReservation {
  has_reservation: boolean
  equipment_requested: EquipmentRequested
  general_facilities: {
    purpose: string
    items: GeneralFacilityItem[]
  }
  function_rooms: {
    purpose: string
    items: FunctionRoomItem[]
  }
  audiovisual_equipment: {
    purpose: string
    items: AudiovisualItem[]
  }
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
  status: "pending" | "approved" | "denied" | "returned"
  /** UUID of the signatory who currently needs to act on this */
  current_signatory: string
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
