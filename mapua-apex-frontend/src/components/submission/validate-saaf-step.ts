import {
  clockFromDraft,
  clockMinutes,
  EVENT_WINDOW_END,
  EVENT_WINDOW_START,
  format24,
  SAME_EVENT_TIME_MESSAGE,
  splitEventTime,
} from "@/components/submission/event-time"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"
import type { Proponent, SaafDraft } from "@/components/submission/types"
import {
  EVENT_DATE_TOO_SOON_MESSAGE,
  minEventDateKey,
} from "@/lib/date-key"

const EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

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

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const REQUIRED = "This field is required."

function proponentWarnings(
  proponent: Proponent,
  department: string,
  warnings: Record<string, string>
): void {
  const key = (field: string) => `proponent.${proponent.id}.${field}`
  if (isBlank(proponent.firstName)) warnings[key("firstName")] = REQUIRED
  if (isBlank(proponent.lastName)) warnings[key("lastName")] = REQUIRED
  if (isBlank(proponent.studentNumber)) warnings[key("studentNumber")] = REQUIRED
  if (isBlank(proponent.programAndYear)) warnings[key("programAndYear")] = REQUIRED
  if (isBlank(proponent.positionOfApplicant)) warnings[key("positionOfApplicant")] = REQUIRED
  if (isBlank(proponent.orgOrCourseSection)) warnings[key("orgOrCourseSection")] = REQUIRED
  if (isBlank(proponent.contactNumber)) warnings[key("contactNumber")] = REQUIRED
  if (isBlank(department)) warnings[key("department")] = REQUIRED

  if (isBlank(proponent.emailAddress)) {
    warnings[key("emailAddress")] = REQUIRED
  } else if (!EMAIL_PATTERN.test(proponent.emailAddress.trim())) {
    warnings[key("emailAddress")] = "Enter a valid email address."
  }

  if (isBlank(proponent.facebookLink)) {
    warnings[key("facebookLink")] = REQUIRED
  } else if (!isValidAbsoluteUrl(proponent.facebookLink.trim())) {
    warnings[key("facebookLink")] = "Enter a valid Facebook URL."
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

  for (const proponent of draft.proponents) {
    proponentWarnings(
      proponent,
      draft.departmentValues[proponent.id] || proponent.department,
      warnings
    )
  }

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
    warnings.activityVenue = REQUIRED
  } else if (draft.activityVenue.trim().length < 5) {
    warnings.activityVenue = "Must be at least 5 characters."
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

  if (isBlank(draft.expectedParticipants)) warnings.expectedParticipants = REQUIRED
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

const STEP_PREFIXES: Record<SaafStepIndex, string[]> = {
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
}

export function getSaafStepIssue(
  step: SaafStepIndex,
  draft: SaafDraft
): string | null {
  const warnings = saafFieldWarnings(draft)
  const prefixes = STEP_PREFIXES[step]
  const messages = Object.entries(warnings)
    .filter(([key]) => prefixes.some((prefix) => key === prefix || key.startsWith(prefix)))
    .map(([, message]) => message)

  return messages[0] ?? null
}

export function isSaafStepComplete(step: SaafStepIndex, draft: SaafDraft): boolean {
  return getSaafStepIssue(step, draft) === null
}

export function isSaafDraftComplete(draft: SaafDraft): boolean {
  return ([0, 1, 2, 3] as const).every((step) => isSaafStepComplete(step, draft))
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
