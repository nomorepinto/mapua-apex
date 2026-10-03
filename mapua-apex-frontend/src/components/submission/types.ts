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
  totalOrgMembers: string
  expectedParticipants: string
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
}

export type SubmissionActionData = {
  success?: boolean
  message?: string
  errors?: Record<string, string>
}
