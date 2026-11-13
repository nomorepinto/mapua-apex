export interface Proponent {
  id: string
  position: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  studentNumber: string
  programAndYear: string
  dateOfSubmission: string
  /** Campus the proponent is from (campus_id); chosen per proponent (S-7). */
  campus: string
  department: string
  positionOfApplicant: string
  orgOrCourseSection: string
  contactNumber: string
  emailAddress: string
  facebookLink: string
}

export interface BudgetItem {
  id: string
  item: string
  unit: string
  quantity: string
  pricePerUnit: string
}

export interface SaafDraft {
  activityType: string
  /** Proponent-chosen nature of activity (S-2); distinct from the OSAAR major/minor nature. */
  activityNature: string[]
  totalOrgMembers: string
  /** Derived total (S-6): mapua + non-Mapua when the switch is ON. */
  expectedParticipants: string
  /** S-6 switch: whether non-Mapuan participants join this event. */
  includeNonMapua: boolean
  mapuaParticipants: string
  nonMapuaParticipants: string
  individualContribution: string
  proposedBudget: string
  dayOfEvent: string
  departmentValues: Record<string, string>
  activityTitle: string
  activityDescription: string
  activityObjectives: string
  activityVenue: string
  dateOfEvent: string
  endDateOfEvent?: string
  timeOfEvent: string
  timeOfEventStart?: string
  timeOfEventEnd?: string
  timeOfEventStartHour?: string
  timeOfEventStartMinute?: string
  timeOfEventStartPeriod?: string
  timeOfEventEndHour?: string
  timeOfEventEndMinute?: string
  timeOfEventEndPeriod?: string
  mission1: boolean
  mission2: boolean
  mission3: boolean
  coreValuesExplanation: string
  peoExplanation: string
  sdgExplanation: string
  proponents: Proponent[]
  budgetItems: BudgetItem[]
  /** Free-text note shown with the detailed budget (required for a with-budget paper). */
  budgetNote: string
  /** Dependent organization ids chosen for collaboration (empty = none). */
  dependentOrgs: string[]
}

export type SubmissionActionData = {
  success?: boolean
  message?: string
  errors?: Record<string, string>
}
