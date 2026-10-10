import {
  clockFromDraft,
  clockMinutes,
  EVENT_WINDOW_END,
  EVENT_WINDOW_START,
  format24,
  SAME_EVENT_TIME_MESSAGE,
  splitEventTime,
} from "@/components/submission/event-time"
import {
  MAX_PROPONENTS,
  MAX_STUDENT_YEAR,
  MIN_STUDENT_YEAR,
  MOBILE_NUMBER_LENGTH,
  STUDENT_NUMBER_LENGTH,
  YEAR_LEVEL_OPTIONS,
} from "@/components/submission/constants"
import type {
  SaafStepIndex,
  WizardStepIndex,
} from "@/components/submission/saaf-stepper"
import type { Proponent, SaafDraft } from "@/components/submission/types"
import type { ReservationDraft } from "@/components/reservation/types"
import {
  EVENT_DATE_TOO_SOON_MESSAGE,
  minEventDateKey,
} from "@/lib/date-key"

const EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@(mymail\.mapua\.edu\.ph|mapua\.edu\.ph)$/i

function isBlank(value: string | undefined): boolean {
  return !value || !value.trim()
}

function eventTimes(draft: SaafDraft): { start: string; end: string } {
  const split = splitEventTime(draft.timeOfEvent || "")
  const start = format24(
    clockFromDraft(
      draft.timeOfEventStartHour,
      draft.timeOfEventStartMinute,
      draft.timeOfEventStartPeriod,
      draft.timeOfEventStart || split.start
    )
  )
  const end = format24(
    clockFromDraft(
      draft.timeOfEventEndHour,
      draft.timeOfEventEndMinute,
      draft.timeOfEventEndPeriod,
      draft.timeOfEventEnd || split.end
    )
  )
  return { start, end }
}

function isInsideEventWindow(value: string): boolean {
  const total = clockMinutes(
    clockFromDraft(undefined, undefined, undefined, value)
  )
  return (
    total !== null && total >= EVENT_WINDOW_START && total <= EVENT_WINDOW_END
  )
}

function isValidFacebookUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!/^https:\/\/(www\.)?facebook\.com\/.+/i.test(trimmed)) {
    return false
  }
  try {
    const url = new URL(trimmed)
    return (
      url.protocol === "https:" &&
      (url.hostname === "facebook.com" || url.hostname === "www.facebook.com") &&
      url.pathname.length > 1
    )
  } catch {
    return false
  }
}

const REQUIRED = "This field is required."

const UNIQUE_PROPONENT_FIELDS: Array<{
  field: keyof Proponent
  label: string
}> = [
    { field: "studentNumber", label: "student number" },
    { field: "contactNumber", label: "mobile number" },
    { field: "positionOfApplicant", label: "position of the applicant" },
    { field: "facebookLink", label: "Facebook link" },
  ]

function markDuplicateProponents(
  proponents: Proponent[],
  warnings: Record<string, string>
): void {
  for (const { field, label } of UNIQUE_PROPONENT_FIELDS) {
    const counts = new Map<string, number>()
    for (const proponent of proponents) {
      const value = String(proponent[field] ?? "").trim().toLowerCase()
      if (!value) continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    for (const proponent of proponents) {
      const value = String(proponent[field] ?? "").trim().toLowerCase()
      if (!value || (counts.get(value) ?? 0) < 2) continue
      const key = `proponent.${proponent.id}.${field}`
      if (!warnings[key]) {
        warnings[key] = `This ${label} is the same as another proponent's.`
      }
    }
  }
}

function proponentWarnings(
  proponent: Proponent,
  department: string,
  warnings: Record<string, string>
): void {
  const key = (field: string) => `proponent.${proponent.id}.${field}`
  if (isBlank(proponent.firstName)) warnings[key("firstName")] = REQUIRED
  if (isBlank(proponent.lastName)) warnings[key("lastName")] = REQUIRED
  if (isBlank(proponent.studentNumber)) {
    warnings[key("studentNumber")] = REQUIRED
  } else if (proponent.studentNumber.trim().length < STUDENT_NUMBER_LENGTH) {
    warnings[key("studentNumber")] =
      `Student number must be ${STUDENT_NUMBER_LENGTH} digits.`
  } else {
    const year = Number(proponent.studentNumber.slice(0, 4))
    if (year < MIN_STUDENT_YEAR || year > MAX_STUDENT_YEAR) {
      warnings[key("studentNumber")] =
        `Student number must start with a year between ${MIN_STUDENT_YEAR} and ${MAX_STUDENT_YEAR}.`
    }
  }
  if (isBlank(proponent.programAndYear)) {
    warnings[key("programAndYear")] = REQUIRED
  } else {
    const trimmed = proponent.programAndYear.trim()
    const hasYear = YEAR_LEVEL_OPTIONS.some((yr) =>
      trimmed.toLowerCase().endsWith(yr.toLowerCase())
    )
    const hasProgram =
      trimmed.includes(" - ") ||
      (!hasYear && !isBlank(trimmed))
    if (!hasYear || !hasProgram) {
      warnings[key("programAndYear")] = "Both program and year level are required."
    }
  }
  if (isBlank(proponent.positionOfApplicant)) warnings[key("positionOfApplicant")] = REQUIRED
  if (isBlank(proponent.orgOrCourseSection)) warnings[key("orgOrCourseSection")] = REQUIRED
  if (isBlank(proponent.contactNumber)) {
    warnings[key("contactNumber")] = REQUIRED
  } else if (!proponent.contactNumber.trim().startsWith("09")) {
    warnings[key("contactNumber")] = "Mobile number must start with 09."
  } else if (proponent.contactNumber.trim().length < MOBILE_NUMBER_LENGTH) {
    warnings[key("contactNumber")] =
      `Mobile number must be ${MOBILE_NUMBER_LENGTH} digits.`
  }
  if (isBlank(department)) warnings[key("department")] = REQUIRED

  if (isBlank(proponent.emailAddress)) {
    warnings[key("emailAddress")] = REQUIRED
  } else if (!EMAIL_PATTERN.test(proponent.emailAddress.trim())) {
    warnings[key("emailAddress")] =
      "Email must end with @mymail.mapua.edu.ph or @mapua.edu.ph."
  }

  if (isBlank(proponent.facebookLink)) {
    warnings[key("facebookLink")] = REQUIRED
  } else if (!isValidFacebookUrl(proponent.facebookLink.trim())) {
    warnings[key("facebookLink")] =
      "Facebook link must start with https://facebook.com/"
  }
}

export function saafFieldWarnings(draft: SaafDraft): Record<string, string> {
  const warnings: Record<string, string> = {}

  if (!draft.activityType) warnings.activityType = "Select an activity type."
  if (isBlank(draft.totalOrgMembers)) {
    warnings.totalOrgMembers = REQUIRED
  } else if (Number(draft.totalOrgMembers) < 30) {
    warnings.totalOrgMembers = "Must be at least 30 members."
  } else if (Number(draft.totalOrgMembers) > 3000) {
    warnings.totalOrgMembers = "Cannot exceed 3000 members."
  }

  if (draft.proponents.length > MAX_PROPONENTS) {
    warnings["proponent.max"] = `A maximum of ${MAX_PROPONENTS} proponents is allowed. Remove ${draft.proponents.length - MAX_PROPONENTS} to continue.`
  }

  for (const proponent of draft.proponents) {
    proponentWarnings(
      proponent,
      draft.departmentValues[proponent.id] || proponent.department,
      warnings
    )
  }

  markDuplicateProponents(draft.proponents, warnings)

  if (isBlank(draft.activityTitle)) warnings.activityTitle = REQUIRED
  if (isBlank(draft.activityDescription)) {
    warnings.activityDescription = REQUIRED
  } else if (draft.activityDescription.trim().length < 100) {
    warnings.activityDescription = "Must be at least 100 characters."
  }
  if (isBlank(draft.activityObjectives)) {
    warnings.activityObjectives = REQUIRED
  } else if (draft.activityObjectives.trim().length < 50) {
    warnings.activityObjectives = "Must be at least 50 characters."
  }
  if (isBlank(draft.activityVenue)) {
    warnings.activityVenue = "Select a venue."
  }

  const startDate = draft.dateOfEvent
  const endDate = draft.endDateOfEvent || draft.dateOfEvent
  if (isBlank(startDate)) warnings.dateOfEvent = REQUIRED
  if (isBlank(endDate)) warnings.endDateOfEvent = REQUIRED
  if (!isBlank(startDate) && startDate < minEventDateKey()) {
    warnings.dateOfEvent = EVENT_DATE_TOO_SOON_MESSAGE
  }
  if (!isBlank(startDate) && !isBlank(endDate) && endDate < startDate) {
    warnings.endDateOfEvent = "End date cannot be earlier than the start date."
  }

  const { start, end } = eventTimes(draft)
  if (!start || !end) {
    warnings.timeOfEvent = REQUIRED
  } else if (!isInsideEventWindow(start) || !isInsideEventWindow(end)) {
    warnings.timeOfEvent = "Event time must be between 7:00 AM and 9:00 PM."
  } else {
    const startMinutes = clockMinutes(clockFromDraft(undefined, undefined, undefined, start))
    const endMinutes = clockMinutes(clockFromDraft(undefined, undefined, undefined, end))
    if (startMinutes !== null && endMinutes !== null && startMinutes === endMinutes) {
      warnings.timeOfEvent = SAME_EVENT_TIME_MESSAGE
    } else if (startMinutes !== null && endMinutes !== null && endMinutes < startMinutes) {
      warnings.timeOfEvent = "End time cannot be earlier than the start time."
    }
  }

  if (isBlank(draft.expectedParticipants)) {
    warnings.expectedParticipants = REQUIRED
  } else if (Number(draft.expectedParticipants) < 20) {
    warnings.expectedParticipants = "Must be at least 20 participants."
  } else if (Number(draft.expectedParticipants) > 3000) {
    warnings.expectedParticipants = "Cannot exceed 3000 participants."
  }
  if (isBlank(draft.individualContribution)) {
    warnings.individualContribution = REQUIRED
  } else if (Number(draft.individualContribution) > 5000) {
    warnings.individualContribution = "Cannot exceed 5000."
  }
  if (isBlank(draft.proposedBudget)) warnings.proposedBudget = REQUIRED

  if (!(draft.mission1 || draft.mission2 || draft.mission3)) {
    warnings.mission = "Select at least one mission statement."
  }
  if ((draft.coreValuesExplanation || "").trim().length < 30) {
    warnings.coreValuesExplanation = isBlank(draft.coreValuesExplanation)
      ? REQUIRED
      : "Must be at least 30 characters."
  }
  if (
    (draft.peoExplanation || "").trim().length > 0 &&
    (draft.peoExplanation || "").trim().length < 30
  ) {
    warnings.peoExplanation = "Must be at least 30 characters if provided."
  }
  if ((draft.sdgExplanation || "").trim().length < 30) {
    warnings.sdgExplanation = isBlank(draft.sdgExplanation)
      ? REQUIRED
      : "Must be at least 30 characters."
  }

  return warnings
}

// Prefixes:
// 0: Classification
// 1: People
// 2: Reservation (activityVenue, dateOfEvent, endDateOfEvent, timeOfEvent & expectedParticipants)
// 3: Activity
// 4: Alignment & Budget
export const STEP_PREFIXES_WITH_RESERVATION: Record<SaafStepIndex, string[]> = {
  0: ["activityType", "totalOrgMembers"],
  1: ["proponent."],
  2: [
    "activityVenue",
    "dateOfEvent",
    "endDateOfEvent",
    "timeOfEvent",
    "expectedParticipants",
  ],
  3: [
    "activityTitle",
    "activityDescription",
    "activityObjectives",
    "individualContribution",
    "proposedBudget",
  ],
  4: ["mission", "coreValuesExplanation", "peoExplanation", "sdgExplanation"],
}

export const STEP_PREFIXES_NO_RESERVATION: Record<SaafStepIndex, string[]> = {
  0: ["activityType", "totalOrgMembers"],
  1: ["proponent."],
  2: [
    "activityTitle",
    "activityDescription",
    "activityObjectives",
    "activityVenue",
    "dateOfEvent",
    "endDateOfEvent",
    "timeOfEvent",
    "expectedParticipants",
    "individualContribution",
    "proposedBudget",
  ],
  3: ["mission", "coreValuesExplanation", "peoExplanation", "sdgExplanation"],
  4: [],
}

/**
 * Warning keys are machine-facing (`activityVenue`, `proponent.<id>.lastName`),
 * so they say nothing to a reader. These labels turn a key into the words the
 * field is actually called on screen, which is what makes a step-level error
 * list actionable.
 */
const WARNING_KEY_LABELS: Record<string, string> = {
  activityType: "Type of activity",
  totalOrgMembers: "Total no. of org members",
  activityTitle: "Title of activity",
  activityDescription: "Description",
  activityObjectives: "Objectives of the activity",
  activityVenue: "Venue campus",
  dateOfEvent: "Start date of event",
  endDateOfEvent: "End date of event",
  timeOfEvent: "Time of event",
  expectedParticipants: "Expected participants",
  individualContribution: "Individual contribution",
  proposedBudget: "Proposed budget",
  mission: "Mission statement",
  coreValuesExplanation: "Core values explanation",
  peoExplanation: "Program educational objectives",
  sdgExplanation: "UN sustainability goals",
}

/** Proponent row fields, keyed by the `Proponent` property name. */
const PROPONENT_FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  studentNumber: "Student number",
  programAndYear: "Program / year level",
  department: "Department",
  positionOfApplicant: "Position of the applicant",
  orgOrCourseSection: "Name of organization",
  contactNumber: "Mobile number",
  emailAddress: "Email address",
  facebookLink: "Facebook link",
}

/**
 * Turns a `saafFieldWarnings` key into a human label. Proponent keys carry the
 * row id, which is resolved to its on-screen row number so a page with several
 * proponents says *which* proponent is short a field.
 */
function warningKeyLabel(key: string, proponents: Proponent[]): string {
  if (key === "proponent.max") return "Number of proponents"
  const match = /^proponent\.([^.]+)\.(.+)$/.exec(key)
  if (match) {
    const index = proponents.findIndex((p) => p.id === match[1])
    const field = PROPONENT_FIELD_LABELS[match[2]] ?? match[2]
    return index >= 0 ? `Proponent ${index + 1} · ${field}` : `Proponent · ${field}`
  }
  return WARNING_KEY_LABELS[key] ?? key
}

/** Raw `[key, message]` warnings that belong to the given wizard step. */
function stepWarningEntries(
  step: SaafStepIndex,
  draft: SaafDraft,
  includeReservation = false
): Array<[string, string]> {
  const warnings = saafFieldWarnings(draft)
  const map = includeReservation
    ? STEP_PREFIXES_WITH_RESERVATION
    : STEP_PREFIXES_NO_RESERVATION

  const prefixes = map[step] || []

  return Object.entries(warnings).filter(([key]) =>
    prefixes.some((prefix) => key === prefix || key.startsWith(prefix))
  )
}

/**
 * Every unresolved field on a step, each prefixed with its label. A failed
 * Continue reveals this list, so the proponent sees all that is missing on the
 * page at once instead of one message per click.
 */
export function getSaafStepIssues(
  step: SaafStepIndex,
  draft: SaafDraft,
  includeReservation = false
): string[] {
  return stepWarningEntries(step, draft, includeReservation).map(
    ([key, message]) => `${warningKeyLabel(key, draft.proponents)}: ${message}`
  )
}

/** Whether the step has nothing left to fill in or correct. */
export function isSaafStepComplete(
  step: SaafStepIndex,
  draft: SaafDraft,
  includeReservation: boolean = false
): boolean {
  return stepWarningEntries(step, draft, includeReservation).length === 0
}

export function isSaafDraftComplete(draft: SaafDraft, includeReservation: boolean = false): boolean {
  const total = includeReservation ? ([0, 1, 2, 3, 4] as const) : ([0, 1, 2, 3] as const)
  return total.every((step) => isSaafStepComplete(step, draft, includeReservation))
}

const RESERVATION_EMPTY_MESSAGE =
  "Select at least one room or equipment to reserve."

export function getReservationStepIssue(
  draft: ReservationDraft,
  campus: string
): string | null {
  const picks = Array.isArray(draft?.picks) ? draft.picks : []
  if (isBlank(campus)) {
    return "Select a campus for the facility reservation."
  }
  if (picks.length === 0) return RESERVATION_EMPTY_MESSAGE

  const missingSelection = picks.find((pick) => pick.selections.length === 0)
  if (missingSelection) {
    return `Pick a date and at least one time slot for "${missingSelection.name}".`
  }
  const hasEmptySlotList = picks.some((pick) =>
    pick.selections.some((selection) => selection.slots.length === 0)
  )
  if (hasEmptySlotList) {
    return "Select at least one time slot for each chosen date."
  }

  return null
}

// The reservation step owns its own catalog picks, which are not part of the
// SAAF draft; label them the same way the field warnings are labelled.
export function getReservationStepIssues(
  draft: ReservationDraft,
  campus: string
): string[] {
  const issue = getReservationStepIssue(draft, campus)
  return issue ? [`Rooms and equipment: ${issue}`] : []
}

export function isReservationStepComplete(
  draft: ReservationDraft,
  campus: string
): boolean {
  return getReservationStepIssue(draft, campus) === null
}

/**
 * First wizard page whose rules still fail. Used to move the proponent to the
 * page that actually holds the problem when a submit is rejected from the last
 * page, instead of leaving them staring at an error about another page's fields.
 */
export function firstIncompleteWizardStep(
  draft: SaafDraft,
  includeReservation: boolean,
  reservationDraft: ReservationDraft
): WizardStepIndex | null {
  const steps = includeReservation
    ? ([0, 1, 2, 3, 4] as const)
    : ([0, 1, 2, 3] as const)

  for (const step of steps) {
    if (!isSaafStepComplete(step, draft, includeReservation)) {
      return step as WizardStepIndex
    }
    // The picks live outside the SAAF draft, so they are checked separately on
    // the reservation page only.
    if (
      includeReservation &&
      step === 2 &&
      !isReservationStepComplete(reservationDraft, draft.activityVenue)
    ) {
      return 2 as WizardStepIndex
    }
  }

  return null
}

export function isStepHtmlValid(panel: HTMLElement): boolean {
  const fields = panel.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input, textarea, select")

  for (const field of fields) {
    if (field.disabled) continue
    if (!field.checkValidity()) return false
  }

  return true
}

export const STEP_INVALID_FOCUS_SELECTOR =
  'input:invalid:not([type="hidden"]), textarea:invalid, select:invalid, .saaf-glow-invalid'

/**
 * Id of the wizard's per-page issue summary. The reveal scrolls to it, so the
 * contract is shared between the hook that reveals and the component that
 * renders the list.
 */
export const SAAF_STEP_ISSUES_ID = "saaf-step-issues"
