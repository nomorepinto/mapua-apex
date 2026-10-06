// ─── Activity domain types ────────────────────────────────────────────────────

export type ActivityDecision = "Review" | "Return" | "Reject"
export type ActivityPriority = "High" | "Medium" | "Low"

export interface Proponent {
  role: string
  name: string
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

export interface RoomRequestedItem {
  roomNeeded: string
  classroomName?: string
  remarks?: string
  dateNeeded?: string
  timeNeeded?: string
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
  title: string
  org: string
  department: string
  date: string
  time?: string
  submittedDate: string
  representative: string
  decision: ActivityDecision
  type: string
  nature?: "major" | "minor" | string
  status?: "Review" | "Returned" | "Rejected" | "Accepted" | "Pending Dean Approval"
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
  /** Grand total of the detailed budget proposal */
  budgetGrandTotal?: number
}

export type StatusVariant = "success" | "warning" | "error" | "outline"

export function getStatusVariant(status: Activity["status"]): StatusVariant {
  switch (status) {
    case "Accepted":
      return "success"
    case "Review":
    case "Pending Dean Approval":
      return "warning"
    case "Returned":
    case "Rejected":
      return "error"
    default:
      return "outline"
  }
}

export function getPriorityStyles(priority: ActivityPriority): { bg: string; text: string } {
  switch (priority) {
    case "High":
      return { bg: "bg-red-600", text: "text-white" }
    case "Medium":
      return { bg: "bg-orange-100", text: "text-orange-700" }
    case "Low":
      return { bg: "bg-blue-100", text: "text-blue-700" }
  }
}

export function getDecisionStyles(decision: ActivityDecision): { bg: string; text: string; border: string } {
  switch (decision) {
    case "Review":
      return { bg: "bg-neutral-100 hover:bg-neutral-200", text: "text-neutral-900 font-semibold", border: "border-neutral-200" }
    case "Return":
      return { bg: "bg-amber-50 hover:bg-amber-100", text: "text-amber-700 font-semibold", border: "border-amber-200" }
    case "Reject":
      return { bg: "bg-red-50 hover:bg-red-100", text: "text-red-700 font-semibold", border: "border-red-200" }
  }
}
