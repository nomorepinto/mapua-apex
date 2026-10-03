import type { CSSProperties } from "react"

import type { BudgetItem, Proponent, SaafDraft } from "@/components/submission/types"

export const DEPARTMENTS = [
  "School of Information Technology (SOIT)",
  "School of EE-ECE-COE (SEECE)",
  "School of Civil, Environmental & Geo Engineering (CEGE)",
  "School of Chemical, Biological & Materials Engineering (CBMES)",
  "School of Mechanical & Manufacturing Engineering (ME-MME)",
  "School of Media Studies (SMS)",
  "School of Liberal Arts (SLA)",
  "E.T. Yuchengco School of Business (ETYSB)",
] as const

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const MISSION_STATEMENTS = [
  {
    key: "mission1",
    name: "mission_competitive",
    text: "The University shall provide a learning environment in order for its students to acquire the attributes that will make them globally competitive.",
  },
  {
    key: "mission2",
    name: "mission_research",
    text: "The Institute shall engage in economically viable research, development, and innovation.",
  },
  {
    key: "mission3",
    name: "mission_solutions",
    text: "The Institute shall provide state-of-the-art solutions to problems of industries and communities.",
  },
] as const

export const SELECT_CONTENT_STYLE: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  overflow: "hidden",
  outline: "none",
  boxShadow:
    "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
}

export const SELECT_ITEM_CLASS =
  "cursor-pointer rounded-lg px-3 py-2 text-sm text-neutral-900 data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900 data-[state=checked]:font-semibold data-[state=checked]:text-neutral-900"

export const FIELD_INPUT_CLASS =
  "h-9.5 rounded-lg border-neutral-300 bg-white !text-neutral-900 placeholder:text-neutral-400"

export const TABLE_INPUT_CLASS =
  "w-full rounded border border-transparent bg-transparent px-2 py-1 text-center !text-neutral-900 focus:border-neutral-300 focus:bg-white focus:outline-none"

export function createEmptyProponent(id: string): Proponent {
  return {
    id,
    position: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    studentNumber: "",
    programAndYear: "",
    dateOfSubmission: new Date().toISOString().split("T")[0],
    department: "",
    positionOfApplicant: "",
    orgOrCourseSection: "",
    contactNumber: "",
    emailAddress: "",
    facebookLink: "",
  }
}

// Default to 1 row with empty item name to show the "Item Name" placeholder
export const DEFAULT_BUDGET_ITEMS: BudgetItem[] = [
  { id: "1", item: "", unit: "1", quantity: "1", pricePerUnit: "0" },
]

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function saafHasUserInput(draft: SaafDraft): boolean {
  if (draft.activityType !== DEFAULT_SAAF_DRAFT.activityType) return true
  if (
    [
      draft.totalOrgMembers,
      draft.expectedParticipants,
      draft.individualContribution,
      draft.proposedBudget,
      draft.dayOfEvent,
      draft.activityTitle,
      draft.activityDescription,
      draft.activityObjectives,
      draft.activityVenue,
      draft.dateOfEvent,
      draft.endDateOfEvent,
      draft.timeOfEvent,
      draft.timeOfEventStart,
      draft.timeOfEventEnd,
      draft.timeOfEventStartHour,
      draft.timeOfEventStartMinute,
      draft.timeOfEventStartPeriod,
      draft.timeOfEventEndHour,
      draft.timeOfEventEndMinute,
      draft.timeOfEventEndPeriod,
      draft.coreValuesExplanation,
      draft.peoExplanation,
      draft.sdgExplanation,
    ].some(filled)
  ) {
    return true
  }
  if (draft.mission1 || draft.mission2 || draft.mission3) return true
  if (Object.values(draft.departmentValues).some(filled)) return true
  if (draft.proponents.length !== 1) return true
  const proponent = draft.proponents[0]
  if (
    proponent &&
    [
      proponent.position,
      proponent.firstName,
      proponent.middleName,
      proponent.lastName,
      proponent.suffix,
      proponent.studentNumber,
      proponent.programAndYear,
      proponent.department,
      proponent.positionOfApplicant,
      proponent.orgOrCourseSection,
      proponent.contactNumber,
      proponent.emailAddress,
      proponent.facebookLink,
    ].some(filled)
  ) {
    return true
  }
  if (draft.budgetItems.length !== DEFAULT_BUDGET_ITEMS.length) return true
  return draft.budgetItems.some(
    (item, index) =>
      filled(item.item) ||
      item.unit !== DEFAULT_BUDGET_ITEMS[index]?.unit ||
      item.quantity !== DEFAULT_BUDGET_ITEMS[index]?.quantity ||
      item.pricePerUnit !== DEFAULT_BUDGET_ITEMS[index]?.pricePerUnit
  )
}

export const DEFAULT_SAAF_DRAFT: SaafDraft = {
  activityType: "co-curricular",
  totalOrgMembers: "",
  expectedParticipants: "",
  individualContribution: "",
  proposedBudget: "",
  dayOfEvent: "",
  departmentValues: {},
  activityTitle: "",
  activityDescription: "",
  activityObjectives: "",
  activityVenue: "",
  dateOfEvent: "",
  endDateOfEvent: "",
  timeOfEvent: "",
  mission1: false,
  mission2: false,
  mission3: false,
  coreValuesExplanation: "",
  peoExplanation: "",
  sdgExplanation: "",
  proponents: [createEmptyProponent("1")],
  budgetItems: DEFAULT_BUDGET_ITEMS,
}