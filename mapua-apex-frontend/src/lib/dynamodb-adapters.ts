import {
  AV_EQUIPMENT_OPTIONS,
  DEFAULT_RESERVATION_DRAFT,
  EQUIPMENT_OPTIONS,
} from "@/components/reservation/constants"
import type { EquipmentItem, ReservationDraft } from "@/components/reservation/types"
import {
  CLASSROOM_ROOM,
  isRoomOfferedAtCampus,
} from "@/lib/campus-rooms"
import {
  createEmptyProponent,
  DEFAULT_BUDGET_ITEMS,
  DEFAULT_SAAF_DRAFT,
} from "@/components/submission/constants"
import type { SaafDraft } from "@/components/submission/types"
import type { Activity } from "@/components/ui/activity.types"
import { getEventSchedule } from "@/lib/event-schedule"

/**
 * Backend API Submission shape returned by Laravel DynamoDB routes
 */
export interface ApiSubmission {
  event_id: string
  submission_id: string
  /** Organization key on the submission item, `ORGANIZATION#<uuid>`. */
  GSI1PK?: string | null
  organization_id?: string | null
  organization_name?: string | null
  submission_type: string
  sent_at: string
  status: "pending" | "approved" | "denied" | "returned"
  current_signatory?: string
  /** Ordered snapshot of signatory IDs (plain, no `SIGNATORY#` prefix) resolved at submit time. */
  signatory_sequence?: string[]
  /**
   * Detail-only: `signatory_sequence` expanded at read time so each hop carries
   * its role plus the organization whose desk it is. Lets a collaboration label
   * steps "{Org}'s Adviser", "{Org}'s Dean", "{Org 2}'s Adviser", … instead of
   * ambiguous duplicate roles. Absent on list endpoints.
   */
  signatory_chain?: ApiSignatoryChainLink[]
  /** Whether the caller's org is the proponent or a collaboration dependent. */
  role?: "proponent" | "dependent"
  /** Collaboration dependents chosen by the proponent (plain ids, no prefix). */
  collaboration?: {
    dependent_organization_ids?: string[]
  }
  activity_classification?: {
    activity_type?: string
    total_org_members?: number
    nature?: "major" | "minor" | string
  }
  proponents?: Array<{
    id: string
    position_title?: string
    first_name?: string
    middle_name?: string
    last_name?: string
    suffix?: string
    student_number?: string
    program_and_year?: string
    date_of_submission?: string
    department?: string
    position_of_applicant?: string
    org_or_course_section?: string
    contact_number?: string
    email_address?: string
    facebook_link?: string
  }>
  activity_details?: {
    title_and_nature?: string
    description?: string
    objectives?: string
    venue?: string
    date_of_event?: string
    end_date_of_event?: string
    day_of_event?: string
    time_of_event?: string
    expected_participants?: number
    individual_contribution?: number
    proposed_budget?: number
  }
  institutional_alignment?: {
    mission_statements?: {
      competitive?: boolean
      research?: boolean
      solutions?: boolean
    }
    core_values_explanation?: string
    peo_explanation?: string
    sdg_explanation?: string
  }
  detailed_budget_proposal?: {
    items?: Array<{
      item_no: string
      /** Free-text measuring unit ("pc", "box", …); legacy rows stored a number. */
      unit: number | string
      quantity: number
      price_per_unit: number
      total: number
    }>
    grand_total: number
  }
  venue_reservation?: {
    has_reservation: boolean
    equipment_requested?: {
      items?: Array<{
        name: string
        purpose?: string
        remark?: string
      }>
    }
    function_rooms?: {
      items?: Array<{
        date_needed: string
        end_date_needed?: string
        time_needed: string
        end_time_needed?: string
        room_needed: string
        /** Classroom code; present only on a `room_needed: "Classroom"` row. */
        classroom_name?: string
        remarks?: string
      }>
    }
    audiovisual_equipment?: {
      items?: Array<{
        date_needed: string
        end_date_needed?: string
        time_needed: string
        end_time_needed?: string
        equipment_needed: string
        remarks?: string
      }>
    }
  }
}

export interface ApiNotification {
  submission_id: string
  sent_at: string
  signatory: string
  notif_type: "approved" | "fully approved" | "denied" | "returned"
  comment?: string
}

/**
 * One hop of the derived approval chain. Campus desks (OSAAR, CDM) have a null
 * organization; adviser/dean hops carry the organization whose desk it is.
 */
export interface ApiSignatoryChainLink {
  signatory_id: string
  role?: string | null
  organization_id?: string | null
  organization_name?: string | null
}

export interface ApiDeadline {
  event_id: string
  deadline_id: string
  sent_at: string
  deadline: string
}

export interface ApiAnnouncement {
  sent_at: string
  content: string
}

export type ApiSignatoryRole =
  | "adviser"
  | "admin"
  | "cdm"
  | "dean"
  | "osaar"

export type OrganizationDeskRole = "adviser" | "admin" | "cdm" | "dean"
export type OrganizationAssignableDeskRole = "dean" | "adviser"
export type SharedSignatoryRole = "admin" | "cdm" | "osaar"

export interface ApiOrganizationSignatory {
  role: OrganizationDeskRole
  signatory_id: string
}

export interface ApiSignatory {
  signatory_id: string
  name: string
  role: ApiSignatoryRole
  department?: string
  organization_id?: string
}

export interface ApiOrganization {
  organization_id: string
  name: string
  is_higher_council?: boolean
  signatories?: ApiOrganizationSignatory[]
}

export type CreateOrganizationPayload = {
  name: string
  is_higher_council?: boolean
  signatories: ApiOrganizationSignatory[]
}

export type CreateSignatoryPayload = {
  name: string
  role: ApiSignatoryRole
  department?: string
}

export function buildSignatoryPayload(
  name: string,
  role: ApiSignatoryRole,
  department?: string | null
): CreateSignatoryPayload {
  const payload: CreateSignatoryPayload = { name, role }
  if (role === "dean") {
    const normalized = department?.trim().toUpperCase()
    if (normalized) {
      payload.department = normalized
    }
  }
  return payload
}

/**
 * Transforms frontend SAAF + Reservation draft states into the exact JSON
 * payload expected by POST /api/v1/students/submissions
 */
export function buildSaafApiPayload(
  saafDraft: SaafDraft,
  reservationDraft?: ReservationDraft | null,
  existingEventId?: string
) {
  const event_id = existingEventId || crypto.randomUUID()
  // Reservation date/time is locked to the event schedule so the stored
  // room/AV items can never disagree with the activity details.
  const schedule = getEventSchedule(saafDraft)
  // Proposed budget is locked to the itemized Detailed Budget grand total so the
  // summary figure and the line-item sum can never disagree.
  const grandTotal = (saafDraft.budgetItems || []).reduce(
    (sum, b) => sum + (Number(b.quantity) || 0) * (Number(b.pricePerUnit) || 0),
    0
  )
  const hasReservation = Boolean(
    reservationDraft &&
    (reservationDraft.roomItems?.length > 0 ||
      reservationDraft.avItems?.length > 0 ||
      reservationDraft.equipmentItems?.length > 0)
  )

  return {
    event_id,
    submission_type: "saaf",
    collaboration: {
      dependent_organization_ids: saafDraft.dependentOrgs || [],
    },
    activity_classification: {
      activity_type: saafDraft.activityType || "extra-curricular",
      total_org_members: Number(saafDraft.totalOrgMembers) || 0,
    },
    proponents: (saafDraft.proponents || []).map((p) => ({
      id: p.id || crypto.randomUUID(),
      position_title: p.position || "",
      first_name: p.firstName || "",
      middle_name: p.middleName || "",
      last_name: p.lastName || "",
      suffix: p.suffix || "",
      student_number: p.studentNumber || "",
      program_and_year: p.programAndYear || "",
      date_of_submission: p.dateOfSubmission || new Date().toISOString().split("T")[0],
      department: saafDraft.departmentValues?.[p.id] || p.department || "",
      position_of_applicant: p.positionOfApplicant || p.position || "",
      org_or_course_section: p.orgOrCourseSection || "",
      contact_number: p.contactNumber || "",
      email_address: p.emailAddress || "",
      facebook_link: p.facebookLink || "",
    })),
    activity_details: {
      title_and_nature: saafDraft.activityTitle || "",
      description: saafDraft.activityDescription || "",
      objectives: saafDraft.activityObjectives || "",
      venue: saafDraft.activityVenue || "",
      date_of_event: saafDraft.dateOfEvent || "",
      end_date_of_event: saafDraft.endDateOfEvent || saafDraft.dateOfEvent || "",
      day_of_event: saafDraft.dayOfEvent || "",
      time_of_event: saafDraft.timeOfEvent || "",
      expected_participants: Number(saafDraft.expectedParticipants) || 0,
      individual_contribution: Number(saafDraft.individualContribution) || 0,
      proposed_budget: grandTotal,
    },
    institutional_alignment: {
      mission_statements: {
        competitive: Boolean(saafDraft.mission1),
        research: Boolean(saafDraft.mission2),
        solutions: Boolean(saafDraft.mission3),
      },
      core_values_explanation: saafDraft.coreValuesExplanation || "",
      peo_explanation: saafDraft.peoExplanation || "",
      sdg_explanation: saafDraft.sdgExplanation || "",
    },
    detailed_budget_proposal: {
      items: (saafDraft.budgetItems || []).map((b, idx) => ({
        item_no: b.item || String(idx + 1),
        // Unit is a free-text label ("pc", "box", …), sent as typed.
        unit: (b.unit || "").trim() || "pc",
        quantity: Number(b.quantity) || 0,
        price_per_unit: Number(b.pricePerUnit) || 0,
        total: (Number(b.quantity) || 0) * (Number(b.pricePerUnit) || 0),
      })),
      grand_total: grandTotal,
    },
    venue_reservation: {
      has_reservation: hasReservation,
      equipment_requested: {
        items: (reservationDraft?.equipmentItems || []).map((e) => ({
          name: e.name,
          purpose: e.purpose || "",
          remark: e.remark || "",
        })),
      },
      function_rooms: {
        items: (reservationDraft?.roomItems || []).map((r) => ({
          date_needed: schedule.startDate,
          end_date_needed: schedule.endDate,
          time_needed: schedule.startTime,
          end_time_needed: schedule.endTime,
          room_needed: r.roomNeeded,
          // Only "Classroom" rows carry a code; fixed rooms are named already.
          ...(r.classroomName ? { classroom_name: r.classroomName } : {}),
          remarks: r.remarks || "",
        })),
      },
      audiovisual_equipment: {
        items: (reservationDraft?.avItems || []).map((a) => ({
          date_needed: schedule.startDate,
          end_date_needed: schedule.endDate,
          time_needed: schedule.startTime,
          end_time_needed: schedule.endTime,
          equipment_needed: a.equipmentNeeded,
          remarks: a.remarks || "",
        })),
      },
    },
  }
}

/**
 * Formats API submission status to frontend badge colors
 */
export function getSubmissionStatusMeta(status: string) {
  switch (status.toLowerCase()) {
    case "approved":
      return { label: "Approved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200" }
    case "denied":
      return { label: "Denied", color: "bg-rose-500/10 text-rose-600 border-rose-200" }
    case "returned":
      return { label: "Returned", color: "bg-amber-500/10 text-amber-600 border-amber-200" }
    case "pending":
    default:
      return { label: "Under Review", color: "bg-amber-500/10 text-amber-600 border-amber-200" }
  }
}

export type DashboardSubmissionStatus = "Under Review" | "Approved" | "Returned" | "Denied"

export interface DashboardSubmissionRow {
  event_id: string
  submission_id: string
  organization_name: string
  id: string
  activity_classification: string
  /** OSAAR-assigned event nature (major / minor). Undefined until OSAAR sets it. */
  nature?: "major" | "minor"
  current_signatory: string
  target_date: string
  requires_venue: boolean
  submitted_date: string
  api_status: "pending" | "approved" | "denied" | "returned"
  activity_details: {
    title: string
    description: string
    objectives?: string
    venue: string
    date: string
    time?: string
    expected_attendees?: number
    budget?: string
    proponent?: string
    requirements?: string[]
  }
  status: DashboardSubmissionStatus
  statusColor: string
  /** Proponent vs collaboration-dependent view for the caller. */
  role?: "proponent" | "dependent"
}

export interface TrackerAssignee {
  role: string
  name: string
  statusText: string
  state: "completed" | "current" | "queued"
}

export interface TrackerStepper {
  fullSteps: string[]
  currentStepIdx: number
  isAllApproved: boolean
  progressPercent: number
  remainingSteps: number
  assigneesList: TrackerAssignee[]
}

export interface DeadlineReminder {
  id: string
  section: "Important" | "Upcoming"
  dateStr: string
  title: string
  code: string
  statusText: string
  dueDateText: string
  isUrgent: boolean
}

export interface ReviewNotice {
  id: string
  eventId: string
  submissionId: string
  sentAt: string
  dateStr: string
  title: string
  notifType: "denied" | "returned"
  comment: string
  signatoryLabel: string
}

export function formatDisplayDate(value?: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatDisplayDateRange(
  start?: string | null,
  end?: string | null
): string {
  if (!start && !end) return "—"
  if (!end || start === end) return formatDisplayDate(start)
  if (!start) return formatDisplayDate(end)

  const startFormatted = formatDisplayDate(start)
  const endFormatted = formatDisplayDate(end)

  if (startFormatted === endFormatted) {
    return startFormatted
  }

  return `${startFormatted} – ${endFormatted}`
}

export function formatDisplayDateTime(value?: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Formats a raw UUID or ID into a clean human-readable document code (e.g., SAAF-1289C970)
 */
export function formatDocumentId(id?: string | null, prefix = "SAAF"): string {
  if (!id || id === "—") return "—"
  const cleaned = id.replace(/^(SUBMISSION#|EVENT#)/i, "")
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)
  if (isUuid) {
    return `${prefix}-${cleaned.slice(0, 8).toUpperCase()}`
  }
  return cleaned
}

function expectedSignatoryRoles(options?: {
  activityType?: string
  hasVenue?: boolean
  isHigherCouncil?: boolean
}): string[] {
  const roles: string[] = ["Adviser"]
  if (options?.activityType === "co-curricular" && !options?.isHigherCouncil) {
    roles.push("Dean")
  }
  roles.push("OSAAR")
  if (options?.hasVenue) {
    roles.push("CDM")
  }
  return roles
}

/**
 * Prefers the authoritative signatory_sequence snapshot stored on the submission;
 * falls back to deriving roles from classification flags for legacy items.
 */
function resolveExpectedRoles(options?: {
  activityType?: string
  hasVenue?: boolean
  isHigherCouncil?: boolean
  orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>
  signatorySequence?: string[]
}): string[] {
  const sequence = options?.signatorySequence
  if (sequence && sequence.length > 0) {
    return sequence.map((id, index) =>
      formatSignatoryRole(
        id,
        options?.orgSignatories,
        index,
        options?.activityType,
        options?.hasVenue,
        options?.isHigherCouncil
      )
    )
  }
  return expectedSignatoryRoles(options)
}

/**
 * Resolves a signatory ID / UUID / role string to a clean human-readable Role name
 */
export function formatSignatoryRole(
  signatoryIdOrRole?: string | null,
  orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>,
  fallbackIndex?: number,
  activityType?: string,
  hasVenue?: boolean,
  isHigherCouncil?: boolean
): string {
  if (!signatoryIdOrRole || signatoryIdOrRole === "—") return "—"

  const raw = signatoryIdOrRole.replace(/^SIGNATORY#/i, "").trim().toLowerCase()

  // Match standard role names
  if (raw === "adviser" || raw.includes("adviser") || raw.startsWith("adv")) return "Adviser"
  if (raw === "dean" || raw.includes("dean")) return "Dean"
  if (raw === "osaar" || raw.includes("osaar") || raw === "osa") return "OSAAR"
  if (raw === "cdm" || raw.includes("cdm")) return "CDM"
  if (raw === "admin" || raw.includes("admin")) return "Admin"
  if (raw === "system") return "System"

  // Check if signatoryId is mapped in org signatories
  if (orgSignatories && orgSignatories.length > 0) {
    const match = orgSignatories.find(
      (s) =>
        s.signatory_id?.toLowerCase() === raw ||
        s.signatory_id?.replace(/^SIGNATORY#/i, "").toLowerCase() === raw
    )
    if (match) {
      if (match.role) {
        const r = match.role.toLowerCase()
        if (r === "adviser") return "Adviser"
        if (r === "dean") return "Dean"
        if (r === "osaar") return "OSAAR"
        if (r === "cdm") return "CDM"
        if (r === "admin") return "Admin"
        return match.role.charAt(0).toUpperCase() + match.role.slice(1)
      }
      if (match.name) return match.name
    }
  }

  // Fallback to submission's expected sequence
  if (fallbackIndex !== undefined) {
    const expectedRoles = expectedSignatoryRoles({
      activityType,
      hasVenue,
      isHigherCouncil,
    })
    if (fallbackIndex >= 0 && fallbackIndex < expectedRoles.length) {
      return expectedRoles[fallbackIndex]
    }
  }

  // If orgSignatories is present and has an assigned adviser/dean but the current signatory
  // is an unmapped ID, it has advanced to the campus-level review desk (OSAAR)
  if (orgSignatories && orgSignatories.length > 0) {
    const hasAdviserAssigned = orgSignatories.some(
      (s) => s.role?.toLowerCase() === "adviser"
    )
    if (hasAdviserAssigned) {
      return "OSAAR"
    }
  }

  // If it's a UUID and nothing matched, default to Adviser for index 0
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return "Signatory"
  }

  return signatoryIdOrRole.charAt(0).toUpperCase() + signatoryIdOrRole.slice(1)
}

/**
 * Labels one derived chain hop. When `qualifyOrg` is set (a collaboration with
 * more than one organization in the chain) an adviser/dean hop is qualified by
 * its organization ("Mapua Computing Society's Adviser"); otherwise — and for
 * the shared campus desks (OSAAR, CDM), which have no organization — it renders
 * as the bare role.
 */
export function signatoryChainLabel(link: ApiSignatoryChainLink, qualifyOrg = true): string {
  const role = formatSignatoryRole(link.role || link.signatory_id)
  const org = qualifyOrg ? link.organization_name?.trim() : ""
  return org ? `${org}'s ${role}` : role
}

export function announcementPath(sentAt: string): string {
  return `/admins/announcements/${encodeURIComponent(sentAt)}`
}

function formatProponentName(
  proponent?: NonNullable<ApiSubmission["proponents"]>[number]
): string {
  if (!proponent) return ""
  return [proponent.first_name, proponent.middle_name, proponent.last_name]
    .filter(Boolean)
    .join(" ")
    .trim()
}

export function submissionOrganizationId(submission: {
  GSI1PK?: string | null
  organization_id?: string | null
}): string {
  const raw = submission.GSI1PK || submission.organization_id || ""
  return raw.replace(/^ORGANIZATION#/i, "")
}

export function organizationNameFor(
  organizationId: string | null | undefined,
  organizations: Array<{ organization_id: string; name: string }>
): string {
  const id = (organizationId || "").replace(/^ORGANIZATION#/i, "")
  if (!id) return "—"
  const match = organizations.find(
    (organization) => organization.organization_id.replace(/^ORGANIZATION#/i, "") === id
  )
  return match?.name || id
}

export function apiSubmissionToDashboardRow(
  submission: ApiSubmission,
  orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>,
  organizations?: Array<{ organization_id: string; name: string }>
): DashboardSubmissionRow {
  const meta = getSubmissionStatusMeta(submission.status)
  const firstProponent = submission.proponents?.[0]
  const title = submission.activity_details?.title_and_nature || "Untitled activity"
  const budget = submission.activity_details?.proposed_budget
  const isApproved = submission.status === "approved"

  let currentSignatoryLabel = "—"
  if (isApproved) {
    currentSignatoryLabel = "Completed"
  } else if (submission.current_signatory) {
    currentSignatoryLabel = formatSignatoryRole(
      submission.current_signatory,
      orgSignatories,
      undefined,
      submission.activity_classification?.activity_type,
      Boolean(submission.venue_reservation?.has_reservation)
    )
  }

  return {
    event_id: submission.event_id,
    submission_id: submission.submission_id,
    organization_name:
      submission.organization_name ||
      organizationNameFor(
        submissionOrganizationId(submission),
        organizations || []
      ),
    id: submission.submission_id,
    activity_classification: submission.activity_classification?.activity_type || "extra-curricular",
    nature: (submission.activity_classification?.nature as "major" | "minor") || undefined,
    current_signatory: currentSignatoryLabel,
    target_date: submission.activity_details?.date_of_event || submission.sent_at,
    requires_venue: Boolean(submission.venue_reservation?.has_reservation),
    submitted_date: formatDisplayDate(submission.sent_at),
    api_status: submission.status,
    activity_details: {
      title,
      description: submission.activity_details?.description || "",
      objectives: submission.activity_details?.objectives || "",
      venue: submission.activity_details?.venue || "—",
      date: formatDisplayDateRange(
        submission.activity_details?.date_of_event,
        submission.activity_details?.end_date_of_event
      ),
      time: submission.activity_details?.time_of_event || "",
      expected_attendees: submission.activity_details?.expected_participants,
      budget: typeof budget === "number" ? `₱${budget.toLocaleString("en-PH")}` : "—",
      proponent: formatProponentName(firstProponent) || firstProponent?.org_or_course_section || "",
      requirements: [],
    },
    status: meta.label as DashboardSubmissionStatus,
    statusColor: meta.color,
    role: submission.role ?? "proponent",
  }
}

export function apiSubmissionToActivity(submission: ApiSubmission): Activity {
  const firstProponent = submission.proponents?.[0]
  const title = submission.activity_details?.title_and_nature || "Untitled activity"
  const budget = submission.activity_details?.proposed_budget
  const objectivesText = submission.activity_details?.objectives || ""
  const objectives = objectivesText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":")
      if (separator > 0) {
        return {
          title: line.slice(0, separator).trim(),
          description: line.slice(separator + 1).trim(),
        }
      }
      return { title: "Objective", description: line }
    })

  const decision: Activity["decision"] =
    submission.status === "denied"
      ? "Reject"
      : submission.status === "returned"
        ? "Return"
        : "Review"

  const status: Activity["status"] =
    submission.status === "approved"
      ? "Accepted"
      : submission.status === "denied"
        ? "Rejected"
        : submission.status === "returned"
          ? "Returned"
          : "Review"

  return {
    id: `${submission.event_id}:${submission.submission_id}`,
    eventId: submission.event_id,
    submissionId: submission.submission_id,
    title,
    org: firstProponent?.org_or_course_section || "Organization",
    department: firstProponent?.department || "—",
    date: formatDisplayDateRange(
      submission.activity_details?.date_of_event,
      submission.activity_details?.end_date_of_event
    ),
    time: submission.activity_details?.time_of_event || "",
    submittedDate: formatDisplayDate(submission.sent_at),
    representative: formatProponentName(firstProponent) || "—",
    type: submission.activity_classification?.activity_type || "extra-curricular",
    nature: (submission.activity_classification?.nature as "major" | "minor") || undefined,
    decision,
    status,
    description: submission.activity_details?.description || "No description provided.",
    venue: submission.activity_details?.venue || "—",
    expectedParticipants: submission.activity_details?.expected_participants || 0,
    proposedBudget:
      typeof budget === "number" ? `₱${budget.toLocaleString("en-PH")}` : "—",
    proponents: (submission.proponents || []).map((proponent) => ({
      role: proponent.position_title || proponent.position_of_applicant || "Proponent",
      name: formatProponentName(proponent) || proponent.student_number || "—",
    })),
    objectives:
      objectives.length > 0
        ? objectives
        : [{ title: "Objective", description: "No objectives listed." }],
  }
}

export function apiNotificationsToStepper(
  notifications: ApiNotification[],
  currentSignatory?: string,
  apiStatus?: ApiSubmission["status"],
  options?: {
    activityType?: string
    hasVenue?: boolean
    isHigherCouncil?: boolean
    orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>
    signatorySequence?: string[]
    signatoryChain?: ApiSignatoryChainLink[]
  }
): TrackerStepper {
  const sorted = [...notifications].sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  const fullyApproved = sorted.some((item) => item.notif_type === "fully approved")
  const isAllApproved = fullyApproved || apiStatus === "approved"

  const stripId = (value?: string | null): string =>
    (value || "").replace(/^SIGNATORY#/i, "").trim()

  const chain = options?.signatoryChain
  const useChain = Array.isArray(chain) && chain.length > 0

  const roleForNotification = (signatory: string, index: number): string =>
    formatSignatoryRole(
      signatory,
      options?.orgSignatories,
      index,
      options?.activityType,
      options?.hasVenue,
      options?.isHigherCouncil
    )

  // Build the ordered steps. With the derived chain each step is keyed by its
  // unique signatory id and labeled "{Org}'s {Role}", so duplicate roles across
  // collaborating organizations stay distinct. Without it (legacy / list views)
  // we fall back to bare role names keyed by the role string.
  const distinctOrgs = useChain
    ? new Set(chain!.map((link) => link.organization_id).filter(Boolean))
    : new Set<string>()
  // Only qualify steps with the organization name when more than one org is in
  // the chain; a single-org paper keeps the clean bare role labels.
  const qualifyOrg = distinctOrgs.size > 1
  const steps: Array<{ key: string; label: string }> = useChain
    ? chain!.map((link) => ({
        key: stripId(link.signatory_id),
        label: signatoryChainLabel(link, qualifyOrg),
      }))
    : resolveExpectedRoles(options).map((role) => ({ key: role, label: role }))

  // Resolve each notification to the step key it belongs to.
  const resolvedNotifs: Array<{
    key: string
    sent_at: string
    notif_type: ApiNotification["notif_type"]
    comment?: string
  }> = sorted.map((item, i) => ({
    key: useChain ? stripId(item.signatory) : roleForNotification(item.signatory, i),
    sent_at: item.sent_at,
    notif_type: item.notif_type,
    comment: item.comment,
  }))

  // Fallback only: surface any recognized role present in the notifications but
  // missing from the derived expectations (the chain path is already complete).
  if (!useChain) {
    for (const n of resolvedNotifs) {
      if (n.key !== "Signatory" && n.key !== "System" && !steps.some((s) => s.key === n.key)) {
        steps.push({ key: n.key, label: n.key })
      }
    }
  }

  const fullSteps = [...steps.map((step) => step.label), "Approved"]

  const latestByKey = new Map<string, (typeof resolvedNotifs)[number]>()
  for (const item of resolvedNotifs) {
    latestByKey.set(item.key, item)
  }

  let currentStepIdx = -1
  if (isAllApproved) {
    currentStepIdx = steps.length
  } else if (currentSignatory) {
    const currentKey = useChain
      ? stripId(currentSignatory)
      : roleForNotification(currentSignatory, resolvedNotifs.length)
    currentStepIdx = steps.findIndex((step) => step.key === currentKey)
  }

  if (!isAllApproved && currentStepIdx === -1) {
    // Check if there's a blocked (denied/returned) notification
    const blocked = [...resolvedNotifs]
      .reverse()
      .find((item) => item.notif_type === "denied" || item.notif_type === "returned")
    if (blocked) {
      currentStepIdx = Math.max(
        0,
        steps.findIndex((step) => step.key === blocked.key)
      )
    } else {
      currentStepIdx = Math.min(resolvedNotifs.length, steps.length - 1)
    }
  }

  const assigneesList: TrackerAssignee[] = steps.map((step, idx) => {
    const latest = latestByKey.get(step.key)
    let state: TrackerAssignee["state"] = "queued"
    let statusText = idx === 0 ? "Queued" : `Queued (Awaiting ${steps[idx - 1].label})`

    if (isAllApproved || idx < currentStepIdx) {
      state = "completed"
      statusText = latest
        ? `${latest.notif_type === "fully approved" ? "Fully approved" : "Approved"} (${formatDisplayDate(latest.sent_at)})`
        : "Approved"
    } else if (idx === currentStepIdx) {
      state = "current"
      if (latest?.notif_type === "denied" || apiStatus === "denied") {
        statusText = latest?.comment
          ? `Denied — ${latest.comment}`
          : "Denied"
      } else if (latest?.notif_type === "returned" || apiStatus === "returned") {
        statusText = latest?.comment
          ? `Returned for revision — ${latest.comment}`
          : "Returned for revision"
      } else {
        statusText = "Pending signature (in review)"
      }
    }

    return { role: step.label, name: step.label, statusText, state }
  })

  assigneesList.push({
    role: "System",
    name: "System sign-off",
    statusText: isAllApproved ? "Approved" : "Queued (pending all signatures)",
    state: isAllApproved ? "completed" : "queued",
  })

  const completedCount = isAllApproved ? steps.length : Math.max(0, currentStepIdx)
  const remainingSteps = Math.max(0, steps.length - completedCount)

  return {
    fullSteps,
    currentStepIdx: isAllApproved ? steps.length : currentStepIdx,
    isAllApproved,
    progressPercent: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0,
    remainingSteps,
    assigneesList,
  }
}

export function apiDeadlinesToReminders(
  deadlines: ApiDeadline[],
  submissions: ApiSubmission[]
): DeadlineReminder[] {
  const titleByEvent = new Map(
    submissions.map((submission) => [
      submission.event_id,
      submission.activity_details?.title_and_nature || submission.submission_id,
    ])
  )
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000

  return deadlines.map((deadline) => {
    const due = new Date(deadline.deadline)
    const dueMs = due.getTime()
    const isUrgent = !Number.isNaN(dueMs) && dueMs - now <= weekMs
    return {
      id: deadline.deadline_id,
      section: isUrgent ? "Important" : "Upcoming",
      dateStr: formatDisplayDate(deadline.sent_at),
      title: titleByEvent.get(deadline.event_id) || "Upcoming deadline",
      code: deadline.event_id,
      statusText: isUrgent ? "Action needed before the deadline" : "Scheduled deadline",
      dueDateText: formatDisplayDate(deadline.deadline),
      isUrgent,
    }
  })
}

export function apiNotificationsToReviewNotices(
  submissions: ApiSubmission[],
  notificationsBySubmission: Map<string, ApiNotification[]>,
  orgSignatories?: Array<{ role?: string; signatory_id?: string; name?: string }>
): ReviewNotice[] {
  const notices: ReviewNotice[] = []

  for (const submission of submissions) {
    const notifications = notificationsBySubmission.get(submission.submission_id) || []
    const title =
      submission.activity_details?.title_and_nature || submission.submission_id

    for (const item of notifications) {
      if (item.notif_type !== "denied" && item.notif_type !== "returned") continue
      const comment = (item.comment || "").trim()
      if (!comment) continue

      notices.push({
        id: `${submission.submission_id}:${item.sent_at}`,
        eventId: submission.event_id,
        submissionId: submission.submission_id,
        sentAt: item.sent_at,
        dateStr: formatDisplayDateTime(item.sent_at),
        title,
        notifType: item.notif_type,
        comment,
        signatoryLabel: formatSignatoryRole(item.signatory, orgSignatories),
      })
    }
  }

  notices.sort((left, right) => right.sentAt.localeCompare(left.sentAt))
  return notices
}

export function apiSubmissionToDrafts(submission: ApiSubmission): {
  saaf: SaafDraft
  reservation: ReservationDraft
  hasReservation: boolean
} {
  const proponents = (submission.proponents || []).map((proponent, index) => ({
    id: proponent.id || String(index + 1),
    position: proponent.position_title || "",
    firstName: proponent.first_name || "",
    middleName: proponent.middle_name || "",
    lastName: proponent.last_name || "",
    suffix: proponent.suffix || "",
    studentNumber: proponent.student_number || "",
    programAndYear: proponent.program_and_year || "",
    dateOfSubmission: proponent.date_of_submission || "",
    department: proponent.department || "",
    positionOfApplicant: proponent.position_of_applicant || "",
    orgOrCourseSection: proponent.org_or_course_section || "",
    contactNumber: proponent.contact_number || "",
    emailAddress: proponent.email_address || "",
    facebookLink: proponent.facebook_link || "",
  }))

  const departmentValues = Object.fromEntries(
    proponents.map((proponent) => [proponent.id, proponent.department])
  )

  const budgetItems =
    submission.detailed_budget_proposal?.items?.map((item, index) => ({
      id: String(index + 1),
      item: item.item_no || String(index + 1),
      unit: String(item.unit || "pc"),
      quantity: String(item.quantity ?? 0),
      pricePerUnit: String(item.price_per_unit ?? 0),
    })) || DEFAULT_BUDGET_ITEMS

  const reservationSource = submission.venue_reservation
  const equipment = reservationSource?.equipment_requested
  // Legacy submissions stored `equipment_requested` as a flat boolean record;
  // newer ones store `{ items: [{ name, purpose, remark }] }`. Rehydrate both,
  // mapping legacy flags to name-only rows (empty purpose/remark).
  const legacyEquipmentLabels: Record<string, string> = {
    monoblock_chairs: "Monoblock Chairs",
    whiteboards: "White Boards",
    tables: "Tables",
    rostrum: "Rostrum",
    flags_with_stand: "Flags (w/ Poles & Stand)",
    panel_boards: "Panel Boards",
  }
  const legacyEquipment = (equipment ?? {}) as Record<string, unknown>
  const legacyOthers =
    typeof legacyEquipment.others_specified === "string"
      ? legacyEquipment.others_specified.trim()
      : ""
  const legacyNames = [
    ...Object.keys(legacyEquipmentLabels)
      .filter((key) => Boolean(legacyEquipment[key]))
      .map((key) => legacyEquipmentLabels[key]),
    ...(legacyOthers ? [legacyOthers] : []),
  ]
  const equipmentItems: EquipmentItem[] = Array.isArray(equipment?.items)
    ? (equipment?.items ?? []).map((item, index) => ({
        id: String(index + 1),
        name: item.name || "",
        purpose: item.purpose || "",
        remark: item.remark || "",
        // A stored name outside the fixed catalog was typed via "Others", so it
        // reopens as an editable custom row.
        isOther: !EQUIPMENT_OPTIONS.includes(item.name || ""),
      }))
    : legacyNames.map((name, index) => ({
        id: String(index + 1),
        name,
        purpose: "",
        remark: "",
        isOther: !EQUIPMENT_OPTIONS.includes(name),
      }))
  const roomCampus = submission.activity_details?.venue || ""
  const reservation: ReservationDraft = {
    equipmentItems,
    roomItems: reservationSource?.function_rooms?.items?.length
      ? reservationSource.function_rooms.items.map((item, index) => ({
        id: String(index + 1),
        dateNeeded: item.date_needed,
        endDateNeeded: item.end_date_needed || item.date_needed,
        timeNeeded: item.time_needed,
        endTimeNeeded: item.end_time_needed || item.time_needed,
        roomNeeded: item.room_needed,
        classroomName: item.classroom_name || "",
        remarks: item.remarks || "",
        // Neither a fixed campus room nor "Classroom" => a custom "Others" row.
        isOther:
          item.room_needed !== CLASSROOM_ROOM &&
          !isRoomOfferedAtCampus(roomCampus, item.room_needed),
      }))
      : DEFAULT_RESERVATION_DRAFT.roomItems,
    avItems: reservationSource?.audiovisual_equipment?.items?.length
      ? reservationSource.audiovisual_equipment.items.map((item, index) => ({
        id: String(index + 1),
        dateNeeded: item.date_needed,
        endDateNeeded: item.end_date_needed || item.date_needed,
        timeNeeded: item.time_needed,
        endTimeNeeded: item.end_time_needed || item.time_needed,
        equipmentNeeded: item.equipment_needed,
        remarks: item.remarks || "",
        isOther: !AV_EQUIPMENT_OPTIONS.includes(item.equipment_needed || ""),
      }))
      : DEFAULT_RESERVATION_DRAFT.avItems,
  }

  return {
    saaf: {
      ...DEFAULT_SAAF_DRAFT,
      activityType: submission.activity_classification?.activity_type || DEFAULT_SAAF_DRAFT.activityType,
      totalOrgMembers: String(submission.activity_classification?.total_org_members ?? ""),
      expectedParticipants: String(submission.activity_details?.expected_participants ?? ""),
      individualContribution: String(submission.activity_details?.individual_contribution ?? ""),
      proposedBudget: String(submission.activity_details?.proposed_budget ?? ""),
      dayOfEvent: submission.activity_details?.day_of_event || "",
      departmentValues,
      activityTitle: submission.activity_details?.title_and_nature || "",
      activityDescription: submission.activity_details?.description || "",
      activityObjectives: submission.activity_details?.objectives || "",
      activityVenue: submission.activity_details?.venue || "",
      dateOfEvent: submission.activity_details?.date_of_event || "",
      endDateOfEvent:
        submission.activity_details?.end_date_of_event ||
        submission.activity_details?.date_of_event ||
        "",
      timeOfEvent: submission.activity_details?.time_of_event || "",
      mission1: Boolean(submission.institutional_alignment?.mission_statements?.competitive),
      mission2: Boolean(submission.institutional_alignment?.mission_statements?.research),
      mission3: Boolean(submission.institutional_alignment?.mission_statements?.solutions),
      coreValuesExplanation: submission.institutional_alignment?.core_values_explanation || "",
      peoExplanation: submission.institutional_alignment?.peo_explanation || "",
      sdgExplanation: submission.institutional_alignment?.sdg_explanation || "",
      proponents: proponents.length > 0 ? proponents : [createEmptyProponent("1")],
      budgetItems,
      dependentOrgs: submission.collaboration?.dependent_organization_ids || [],
    },
    reservation,
    hasReservation: Boolean(reservationSource?.has_reservation),
  }
}

export function omitEventIdFromPayload<T extends { event_id?: string }>(payload: T) {
  const rest = { ...payload }
  delete rest.event_id
  return rest
}