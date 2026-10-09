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
  isVenue,
  MAX_PROPONENTS,
  MAX_STUDENT_YEAR,
  MIN_STUDENT_YEAR,
  MOBILE_NUMBER_LENGTH,
  STUDENT_NUMBER_LENGTH,
  YEAR_LEVEL_OPTIONS,
} from "@/components/submission/constants"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"
import type { Proponent, SaafDraft } from "@/components/submission/types"
import type { ReservationDraft } from "@/components/reservation/types"
import {
  CLASSROOM_ROOM,
  isRoomOfferedAtCampus,
} from "@/lib/campus-rooms"
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
  } else if (draft.totalOrgMembers.length > 5) {
    warnings.totalOrgMembers = "Cannot exceed 5 digits."
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
  } else if (!isVenue(draft.activityVenue)) {
    warnings.activityVenue = "Select a venue from the list."
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
  } else if (Number(draft.expectedParticipants) < 30) {
    warnings.expectedParticipants = "Must be at least 30 participants."
  } else if (Number(draft.expectedParticipants) > 3000) {
    warnings.expectedParticipants = "Cannot exceed 3000 participants."
  }
  if (isBlank(draft.individualContribution)) warnings.individualContribution = REQUIRED
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
// 2: Reservation (timeOfEvent & expectedParticipants)
// 3: Activity
// 4: Alignment & Budget
export const STEP_PREFIXES_WITH_RESERVATION: Record<SaafStepIndex, string[]> = {
  0: ["activityType", "totalOrgMembers"],
  1: ["proponent."],
  2: ["timeOfEvent", "expectedParticipants"],
  3: [
    "activityTitle",
    "activityDescription",
    "activityObjectives",
    "activityVenue",
    "dateOfEvent",
    "endDateOfEvent",
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

export function getSaafStepIssue(
  step: SaafStepIndex,
  draft: SaafDraft,
  includeReservation: boolean = false
): string | null {
  const warnings = saafFieldWarnings(draft)
  const map = includeReservation
    ? STEP_PREFIXES_WITH_RESERVATION
    : STEP_PREFIXES_NO_RESERVATION

  const prefixes = map[step] || []

  const messages = Object.entries(warnings)
    .filter(([key]) => prefixes.some((prefix) => key === prefix || key.startsWith(prefix)))
    .map(([, message]) => message)

  return messages[0] ?? null
}

export function isSaafStepComplete(
  step: SaafStepIndex,
  draft: SaafDraft,
  includeReservation: boolean = false
): boolean {
  return getSaafStepIssue(step, draft, includeReservation) === null
}

export function isSaafDraftComplete(draft: SaafDraft, includeReservation: boolean = false): boolean {
  const total = includeReservation ? ([0, 1, 2, 3, 4] as const) : ([0, 1, 2, 3] as const)
  return total.every((step) => isSaafStepComplete(step, draft, includeReservation))
}

const RESERVATION_EMPTY_MESSAGE =
  "Add at least one equipment, room, or audiovisual item."

export function getReservationStepIssue(
  draft: ReservationDraft,
  campus: string
): string | null {
  const hasItems =
    draft.equipmentItems.length > 0 ||
    draft.roomItems.length > 0 ||
    draft.avItems.length > 0
  if (!hasItems) return RESERVATION_EMPTY_MESSAGE

  if (draft.equipmentItems.some((item) => item.isOther && isBlank(item.name))) {
    return "Enter a name for the custom equipment item."
  }
  if (
    draft.avItems.some((item) => item.isOther && isBlank(item.equipmentNeeded))
  ) {
    return "Enter a name for the custom audiovisual equipment."
  }
  if (draft.roomItems.some((item) => item.isOther && isBlank(item.roomNeeded))) {
    return "Enter a name for the custom room."
  }

  const offCampus = draft.roomItems.find(
    (item) => !item.isOther && !isRoomOfferedAtCampus(campus, item.roomNeeded)
  )
  if (offCampus) {
    return `Remove "${offCampus.roomNeeded}" — it is not offered at ${campus || "the selected campus"}.`
  }

  return null
}

export function isReservationStepComplete(
  draft: ReservationDraft,
  campus: string
): boolean {
  return getReservationStepIssue(draft, campus) === null
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

export function getMovedReservationFieldsIssue(draft: SaafDraft): string | null {
  const warnings = saafFieldWarnings(draft)
  return warnings.timeOfEvent || warnings.expectedParticipants || null
}