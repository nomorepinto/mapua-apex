// ─── Activity domain types ────────────────────────────────────────────────────

import type { OutsideEquipmentItem } from "@/lib/types"

export type ActivityDecision = "Review" | "Return" | "Reject"
export type ActivityPriority = "High" | "Medium" | "Low"

export interface Proponent {
  role: string
  name: string
  /** Proponent email address (S-7 reviewer visibility). */
  email?: string
  /** Campus the proponent is from (stored campus_id; S-7). */
  campus?: string
  /** Officer-chosen department code (S-7). */
  department?: string
}

export interface Objective {
  title: string
  description: string
}

export interface EquipmentItem {
  name: string
  purpose?: string
  remark?: string
}

/** S-8 CDM ruling for one outside-equipment item. */
export interface OutsideEquipmentDecision {
  name: string
  allowed: boolean
}

export interface RoomRequestedItem {
  roomNeeded: string
  classroomName?: string
  remarks?: string
  dateNeeded?: string
  endDateNeeded?: string
  timeNeeded?: string
  endTimeNeeded?: string
}

export interface AvEquipmentItem {
  equipmentNeeded: string
  remarks?: string
  dateNeeded?: string
  timeNeeded?: string
}

export interface ActivityBudgetItem {
  item: string
  unit: number | string
  quantity: number
  pricePerUnit: number
  total: number
}

export interface Activity {
  id: string
  eventId: string
  submissionId: string
  /** Stored `SAAF-YYMMDD-###` when the paper has one. */
  documentNumber?: string | null
  title: string
  org: string
  department: string
  /** Abbreviation/code of the lead proponent's department (e.g. "SOIT"; "—" when unavailable). */
  departmentCode: string
  date: string
  time?: string
  submittedDate: string
  /** Raw submission timestamp (ISO 8601) used for chronological sorting. */
  submittedAt: string
  representative: string
  decision: ActivityDecision
  type: string
  nature?: "major" | "minor" | string
  /** S-2 proponent-chosen nature of activity; distinct from the OSAAR major/minor nature. */
  natureOfActivity?: string[]
  status?:
    | "Review"
    | "Returned"
    | "Rejected"
    | "Accepted"
    | "Pending Dean Approval"
    | "Cancelled"
    | "Finished"
  description: string
  venue: string
  expectedParticipants: number
  proposedBudget: string
  proponents: Proponent[]
  objectives: Objective[]
  /** Equipment items requested in the venue reservation form. Empty array when no reservation or no equipment. */
  equipmentRequested: EquipmentItem[]
  /** Rooms requested in the venue reservation form */
  roomsRequested?: RoomRequestedItem[]
  /** Audio-visual equipment requested in the venue reservation form */
  avEquipmentRequested?: AvEquipmentItem[]
  /** Detailed budget proposal items */
  budgetItems?: ActivityBudgetItem[]
  /** Whether the activity has a venue/equipment reservation requested */
  hasReservation?: boolean
  /** Whether the activity operates with a budget (absent on legacy rows = true). */
  hasBudget?: boolean
  /** Funding sources picked on the proposal setup step (stored slugs; empty/absent on legacy rows). */
  fundingSources?: string[]
  /** Free-text budget note (empty/absent on legacy or no-budget rows). */
  budgetNote?: string
  /** Raw start date of the event in YYYY-MM-DD */
  dateOfEvent?: string
  /** Raw end date of the event in YYYY-MM-DD */
  endDateOfEvent?: string
  /** Grand total of the detailed budget proposal */
  budgetGrandTotal?: number
  /** RA 10173 consent of record; absent on papers filed before the consent gate. */
  privacyConsent?: { version: string; acceptedAt: string }
  /** S-8 outside equipment (not from Mapua) the student declared. */
  outsideEquipment?: OutsideEquipmentItem[]
  /** S-8 CDM per-item rulings on the outside equipment. */
  outsideEquipmentDecisions?: OutsideEquipmentDecision[]
}

export type StatusVariant = "success" | "warning" | "error" | "outline"

export function getStatusVariant(status: Activity["status"]): StatusVariant {
  switch (status) {
    case "Accepted":
    case "Finished":
      return "success"
    case "Review":
    case "Pending Dean Approval":
      return "warning"
    case "Returned":
    case "Rejected":
      return "error"
    case "Cancelled":
      return "outline"
    default:
      return "outline"
  }
}

export function getPriorityStyles(priority: ActivityPriority): {
  bg: string
  text: string
} {
  switch (priority) {
    case "High":
      return { bg: "bg-red-600", text: "text-white" }
    case "Medium":
      return { bg: "bg-orange-100", text: "text-orange-700" }
    case "Low":
      return { bg: "bg-blue-100", text: "text-blue-700" }
  }
}

export function getDecisionStyles(decision: ActivityDecision): {
  bg: string
  text: string
  border: string
} {
  switch (decision) {
    case "Review":
      return {
        bg: "bg-neutral-100 hover:bg-neutral-200",
        text: "text-neutral-900 font-semibold",
        border: "border-neutral-200",
      }
    case "Return":
      return {
        bg: "bg-amber-50 hover:bg-amber-100",
        text: "text-amber-700 font-semibold",
        border: "border-amber-200",
      }
    case "Reject":
      return {
        bg: "bg-red-50 hover:bg-red-100",
        text: "text-red-700 font-semibold",
        border: "border-red-200",
      }
  }
}
