import type { CSSProperties } from "react"

import type { BudgetItem, Proponent, SaafDraft } from "@/components/submission/types"
import type { SaafStepIndex } from "@/components/submission/saaf-stepper"

export interface DepartmentItem {
  code: string
  name: string
}

export interface DepartmentGroup {
  campus: string
  departments: readonly DepartmentItem[]
}

export const DEPARTMENT_GROUPS: readonly DepartmentGroup[] = [
  {
    campus: "Intramuros Campus",
    departments: [
      { code: "ARIDBE", name: "School of Architecture, Industrial Design, and the Built Environment" },
      { code: "CBMES", name: "School of Chemical, Biological, and Materials Engineering and Sciences" },
      { code: "CEGE", name: "School of Civil, Environmental, and Geological Engineering" },
      { code: "EECE", name: "School of Electrical, Electronics, and Computer Engineering" },
      { code: "IE-EM", name: "School of Industrial Engineering and Engineering Management" },
      { code: "MME", name: "School of Mechanical, Manufacturing, and Energy Engineering" },
      { code: "SFSE", name: "School of Foundational Studies and Education" },
      { code: "DLA", name: "Department of Liberal Arts" },
      { code: "MATH", name: "Department of Mathematics" },
      { code: "PE", name: "Department of Physical Education and Athletics" },
      { code: "PHYS", name: "Department of Physics" },
      { code: "SHS-INTRA", name: "SHS (Intramuros)" },
    ],
  },
  {
    campus: "Makati Campus",
    departments: [
      { code: "SOIT", name: "School of Information Technology" },
      { code: "SMDA", name: "School of Multimedia and Digital Arts" },
      { code: "ETYSB", name: "E.T. Yuchengco School of Business" },
      { code: "SHS-HEALTH", name: "School of Health Sciences" },
      { code: "SON", name: "School of Nursing" },
      { code: "SOM", name: "School of Medicine" },
      { code: "SHS-MAKATI", name: "SHS (Makati)" },
    ],
  },
  {
    campus: "Seda Hotel, Manila Bay",
    departments: [
      { code: "STHM", name: "School of Tourism and Hospitality Management" },
    ],
  },
] as const

export const ALL_DEPARTMENT_ITEMS: readonly DepartmentItem[] = DEPARTMENT_GROUPS.flatMap(
  (group) => group.departments
)

export const DEPARTMENTS = ALL_DEPARTMENT_ITEMS.map((dept) => dept.name) as readonly string[]

export type Department = (typeof DEPARTMENTS)[number]

export function getDepartmentItem(nameOrCode: string | null | undefined): DepartmentItem | undefined {
  if (!nameOrCode) return undefined
  const needle = nameOrCode.trim().toUpperCase()
  return ALL_DEPARTMENT_ITEMS.find(
    (d) => d.code.toUpperCase() === needle || d.name.toUpperCase() === needle
  )
}

export const COLLEGE_YEAR_LEVEL_OPTIONS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
] as const

export const SHS_YEAR_LEVEL_OPTIONS = ["11", "12"] as const

export const YEAR_LEVEL_OPTIONS = [
  ...COLLEGE_YEAR_LEVEL_OPTIONS,
  ...SHS_YEAR_LEVEL_OPTIONS,
] as const

export type YearLevel = (typeof YEAR_LEVEL_OPTIONS)[number]

export function isShsDepartment(nameOrCode: string | null | undefined): boolean {
  if (!nameOrCode) return false
  const item = getDepartmentItem(nameOrCode)
  const code = item?.code ?? nameOrCode.trim().toUpperCase()
  return code === "SHS-INTRA" || code === "SHS-MAKATI"
}

export function getYearLevelOptions(
  deptNameOrCode: string | null | undefined
): readonly string[] {
  return isShsDepartment(deptNameOrCode)
    ? SHS_YEAR_LEVEL_OPTIONS
    : COLLEGE_YEAR_LEVEL_OPTIONS
}

export interface ProgramItem {
  code: string
  name: string
}

export const DEPARTMENT_PROGRAMS: Record<string, readonly ProgramItem[]> = {
  // Intramuros Campus
  ARIDBE: [
    { code: "BS-AR", name: "BS Architecture" },
    { code: "BS-ID", name: "BS Industrial Design" },
    { code: "BS-INT", name: "BS Interior Design" },
    { code: "BS-EP", name: "BS Environmental Planning" },
    { code: "BS-UP", name: "BS Urban Planning" },
    { code: "MS-AR", name: "MS Architecture" },
    { code: "BS-AR → MS-AR", name: "BS Architecture → MS Architecture" },
  ],
  CBMES: [
    { code: "BSChE", name: "BS Chemical Engineering" },
    { code: "BS-CHM", name: "BS Chemistry" },
    { code: "BSBE", name: "BS Biological Engineering" },
    { code: "BSMSE", name: "BS Materials Science and Engineering" },
    { code: "BSChE + BS-CHM", name: "BS Chemical Engineering + BS Chemistry" },
    { code: "MSBE", name: "MS Biological Engineering" },
    { code: "MSChE", name: "MS Chemical Engineering" },
    { code: "MS-CHM", name: "MS Chemistry" },
    { code: "MSMSE", name: "MS Materials Science and Engineering" },
    { code: "PhD-ChE", name: "PhD in Chemical Engineering" },
    { code: "PhD-CHM", name: "PhD in Chemistry" },
    { code: "PhD-MSE", name: "PhD in Materials Science and Engineering" },
    { code: "BSBE → MSBE", name: "BS Biological Engineering → MS Biological Engineering" },
    { code: "BSChE → MSChE", name: "BS Chemical Engineering → MS Chemical Engineering" },
    { code: "BSMSE → MSMSE", name: "BS Materials Science and Engineering → MS Materials Science and Engineering" },
  ],
  CEGE: [
    { code: "BSCE", name: "BS Civil Engineering" },
    { code: "BS-ENSE", name: "BS Environmental and Sanitary Engineering" },
    { code: "BS-GEO", name: "BS Geology" },
    { code: "BSCEM", name: "BS Construction Engineering and Management" },
    { code: "BSGSE", name: "BS Geological Science and Engineering" },
    { code: "BSCE + BSMSE", name: "BS Civil Engineering + BS Materials Science and Engineering" },
    { code: "BSCE + BS-ENSE", name: "BS Civil Engineering + BS Environmental and Sanitary Engineering" },
    { code: "MSCE", name: "MS Civil Engineering" },
    { code: "MSCEM", name: "MS Construction Engineering and Management" },
    { code: "MSEnE", name: "MS Environmental Engineering" },
    { code: "PhD-EnE", name: "PhD in Environmental Engineering" },
    { code: "BSCE → MSCE", name: "BS Civil Engineering → MS Civil Engineering" },
    { code: "BSCEM → MSCEM", name: "BS Construction Engineering and Management → MS Construction Engineering and Management" },
  ],
  EECE: [
    { code: "BSEE", name: "BS Electrical Engineering" },
    { code: "BSCpE", name: "BS Computer Engineering" },
    { code: "BSECE", name: "BS Electronics Engineering" },
    { code: "BSAIE", name: "BS Artificial Intelligence Engineering" },
    { code: "ME-CpE", name: "Master of Engineering in Computer Engineering" },
    { code: "ME-EE", name: "Master of Engineering in Electrical Engineering" },
    { code: "ME-ECE", name: "Master of Engineering in Electronics Engineering" },
    { code: "MSCpE", name: "MS Computer Engineering" },
    { code: "MSEE", name: "MS Electrical Engineering" },
    { code: "MSECE", name: "MS Electronics Engineering" },
    { code: "PhD-CpE", name: "PhD in Computer Engineering" },
    { code: "PhD-ECE", name: "PhD in Electronics Engineering" },
    { code: "BSECE → MSECE", name: "BS Electronics Engineering → MS Electronics Engineering" },
    { code: "BSEE → MSEE", name: "BS Electrical Engineering → MS Electrical Engineering" },
    { code: "BSCpE → MSCpE", name: "BS Computer Engineering → MS Computer Engineering" },
  ],
  "IE-EM": [
    { code: "BSIE", name: "BS Industrial Engineering" },
    { code: "BSManE", name: "BS Management Engineering" },
    { code: "ME-IE", name: "Master of Engineering in Industrial Engineering" },
    { code: "MSEM", name: "MS Engineering Management" },
    { code: "MSIE", name: "MS Industrial Engineering" },
    { code: "PhD-IE", name: "PhD in Industrial Engineering" },
    { code: "BSIE → MSIE", name: "BS Industrial Engineering → MS Industrial Engineering" },
    { code: "BSManE → MSSEM", name: "BS Management Engineering → MS Service Engineering and Management" },
  ],
  MME: [
    { code: "BSME", name: "BS Mechanical Engineering" },
    { code: "BSEnE", name: "BS Energy Engineering" },
    { code: "BSMfgE", name: "BS Manufacturing Engineering" },
    { code: "BSME + BSBE", name: "BS Mechanical Engineering + BS Biological Engineering" },
    { code: "BSME + BSMSE", name: "BS Mechanical Engineering + BS Materials Science and Engineering" },
    { code: "MSME", name: "MS Mechanical Engineering" },
    { code: "PhD-ME", name: "PhD in Mechanical Engineering" },
    { code: "BSME → MSME", name: "BS Mechanical Engineering → MS Mechanical Engineering" },
  ],
  SFSE: [
    { code: "BSTC", name: "BS Technical Communication" },
    { code: "BPE-SWM", name: "Bachelor of Physical Education Major in Sports Wellness and Management" },
    { code: "BS-PHY", name: "BS Physics" },
  ],
  DLA: [
    { code: "BSTC", name: "BS Technical Communication" },
    { code: "BA-COMM", name: "BA Communication" },
    { code: "BA-BM", name: "BA Broadcast Media" },
    { code: "GenEd", name: "General Education" },
  ],
  MATH: [
    { code: "BS-MATH", name: "BS Mathematics" },
    { code: "BS-AMATH", name: "BS Applied Mathematics" },
    { code: "BSDS", name: "BS Data Science" },
  ],
  PE: [
    { code: "BPE-SWM", name: "Bachelor of Physical Education Major in Sports Wellness and Management" },
    { code: "PE", name: "Physical Education" },
  ],
  PHYS: [
    { code: "BS-PHY", name: "BS Physics" },
    { code: "BS-PHY + BSECE", name: "BS Physics + BS Electronics Engineering" },
    { code: "BS-PHY + BSEE", name: "BS Physics + BS Electrical Engineering" },
    { code: "BS-PHY + BSMSE", name: "BS Physics + BS Materials Science and Engineering" },
  ],
  "SHS-INTRA": [
    { code: "STEM", name: "Science, Technology, Engineering, and Mathematics" },
    { code: "ABM", name: "Accountancy, Business, and Management" },
    { code: "HUMSS", name: "Humanities and Social Sciences" },
    { code: "GAS", name: "General Academic Strand" },
  ],
  // Makati Campus
  SOIT: [
    { code: "BSIT", name: "BS Information Technology" },
    { code: "BSCS", name: "BS Computer Science" },
    { code: "BSDS", name: "BS Data Science" },
    { code: "BSEMC", name: "BS Entertainment and Multimedia Computing" },
    { code: "BSIS", name: "BS Information Systems" },
    { code: "BSCS-CYBER", name: "BS Cybersecurity" },
    { code: "MIT", name: "Master in Information Technology" },
    { code: "MSCS", name: "MS Computer Science" },
    { code: "PhD-CS", name: "PhD in Computer Science" },
    { code: "BSCS → MSCS", name: "BS Computer Science → MS Computer Science" },
    { code: "BSIS → MANAL", name: "BS Information Systems → Master in Business Analytics" },
    { code: "BSIT → MIT", name: "BS Information Technology → Master in Information Technology" },
  ],
  SMDA: [
    { code: "BADF", name: "BA Digital Film" },
    { code: "BADJ", name: "BA Digital Journalism" },
    { code: "BMMA", name: "BA Multimedia Arts" },
    { code: "BAAD", name: "BA Advertising Design" },
    { code: "BABM", name: "BA Broadcast Media" },
    { code: "BMMA + BABM", name: "BA Multimedia Arts + BA Broadcast Media" },
    { code: "BMMA + BADJ", name: "BA Multimedia Arts + BA Digital Journalism" },
    { code: "MAMMA", name: "MA Multimedia Arts" },
    { code: "MAFP", name: "MA Film Production" },
    { code: "PhD-MMA", name: "PhD in Multimedia Arts" },
    { code: "BMMA → MAMMA", name: "BA Multimedia Arts → MA Multimedia Arts" },
  ],
  ETYSB: [
    { code: "BSA", name: "BS Accountancy" },
    { code: "BSBA", name: "BS Business Administration" },
    { code: "BSBA-AI", name: "BS Business Analytics with AI" },
    { code: "BSIB", name: "BS International Business" },
    { code: "BSM", name: "BS Marketing" },
    { code: "BSREM", name: "BS Real Estate Management" },
    { code: "BSBIA", name: "BS Business Intelligence and Analytics" },
    { code: "BSFinTech", name: "BS Financial Technology" },
    { code: "BSGM", name: "BS Global Management" },
    { code: "BSEntrep", name: "BS Entrepreneurship" },
    { code: "MBA", name: "Master in Business Administration" },
    { code: "MANAL", name: "Master in Business Analytics" },
    { code: "DBA", name: "Doctor of Business Administration" },
    { code: "BSA → MANAL", name: "BS Accountancy → Master in Business Analytics" },
    { code: "BSBA → MANAL", name: "BS Business Administration → Master in Business Analytics" },
  ],
  "SHS-HEALTH": [
    { code: "BA-PSY", name: "BA Psychology" },
    { code: "BS-BIO", name: "BS Biology" },
    { code: "BSMT", name: "BS Medical Technology" },
    { code: "BS-PHARM", name: "BS Pharmacy" },
    { code: "BSPT", name: "BS Physical Therapy" },
    { code: "BS-PSY", name: "BS Psychology" },
    { code: "BSRT", name: "BS Radiologic Technology" },
    { code: "MAPSY", name: "MA Psychology" },
    { code: "BA-PSY → MAPSY", name: "BA Psychology → MA Psychology" },
    { code: "BS-PSY → MAPSY", name: "BS Psychology → MA Psychology" },
  ],
  SON: [
    { code: "BSN", name: "BS Nursing" },
  ],
  SOM: [
    { code: "MD", name: "Doctor of Medicine" },
  ],
  "SHS-MAKATI": [
    { code: "STEM", name: "Science, Technology, Engineering, and Mathematics" },
    { code: "ABM", name: "Accountancy, Business, and Management" },
    { code: "HUMSS", name: "Humanities and Social Sciences" },
    { code: "GAS", name: "General Academic Strand" },
    { code: "ADT", name: "Arts and Design Track" },
  ],
  // Seda Hotel, Manila Bay
  STHM: [
    { code: "BSTM", name: "BS Tourism Management" },
    { code: "BSHM", name: "BS Hospitality Management" },
  ],
}

// Index programs by full name as well for reverse compatibility
ALL_DEPARTMENT_ITEMS.forEach((dept) => {
  if (DEPARTMENT_PROGRAMS[dept.code] && !DEPARTMENT_PROGRAMS[dept.name]) {
    DEPARTMENT_PROGRAMS[dept.name] = DEPARTMENT_PROGRAMS[dept.code]
  }
})

export function getDepartmentPrograms(deptNameOrCode: string | null | undefined): readonly ProgramItem[] {
  const item = getDepartmentItem(deptNameOrCode)
  if (!item) return []
  return DEPARTMENT_PROGRAMS[item.code] ?? []
}

export function getProgramItem(
  deptNameOrCode: string | null | undefined,
  progNameOrCode: string | null | undefined
): ProgramItem | undefined {
  if (!progNameOrCode) return undefined
  const programs = getDepartmentPrograms(deptNameOrCode)
  const needle = progNameOrCode.trim().toUpperCase()
  const found = programs.find((p) => p.code.toUpperCase() === needle || p.name.toUpperCase() === needle)
  if (found) return found

  // Global fallback across all programs
  for (const list of Object.values(DEPARTMENT_PROGRAMS)) {
    const match = list.find((p) => p.code.toUpperCase() === needle || p.name.toUpperCase() === needle)
    if (match) return match
  }
  return undefined
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

/**
 * Venue for an activity held digitally instead of at a physical campus. The
 * list of physical venues is no longer hardcoded here: campuses live in
 * DynamoDB and are fetched via `useStudentCampusesQuery`, with "Online" appended
 * for the no-reservation flow. "Online" is a valid venue but never a reservable
 * campus, so it implies `has_reservation = false`.
 */
export const ONLINE_VENUE = "Online"

/** Fixed digit-length for the proponent's institutional student number. */
export const STUDENT_NUMBER_LENGTH = 10

/** Minimum and maximum allowable admission year for Mapúa student numbers. */
export const MIN_STUDENT_YEAR = 2016
export const MAX_STUDENT_YEAR = 2026

/**
 * Validates that an in-progress or completed student number has a first 4 digits
 * consistent with an admission year in the allowed [2016, 2026] range.
 */
export function isValidStudentNumberPrefix(val: string): boolean {
  if (!val) return true
  const prefix = val.slice(0, Math.min(val.length, 4))
  if (prefix.length < 4) {
    for (let y = MIN_STUDENT_YEAR; y <= MAX_STUDENT_YEAR; y++) {
      if (String(y).startsWith(prefix)) return true
    }
    return false
  }
  const year = Number(prefix)
  return year >= MIN_STUDENT_YEAR && year <= MAX_STUDENT_YEAR
}

/** Upper bound on proponents a single SAAF application may list (Section 2). */
export const MAX_PROPONENTS = 5

/**
 * Fixed digit-length for a Philippine mobile number (09XXXXXXXXX). Enforcing the
 * full length is what keeps landlines (shorter, area-coded) out of the field.
 */
export const MOBILE_NUMBER_LENGTH = 11

export const MOBILE_NUMBER_PREFIX = "09"

/**
 * Validates that an in-progress or completed mobile number starts with '09'.
 */
export function isValidMobileNumberPrefix(val: string): boolean {
  if (!val) return true
  if (val.length === 1) return val === "0"
  return val.startsWith(MOBILE_NUMBER_PREFIX)
}

/**
 * Sanitizes and normalizes a mobile number input so that it always starts with '09'.
 * Handles international prefix (+639 / 639), auto-prepends '09' for other digits,
 * and rejects any edits that would change the required '09' prefix.
 */
export function sanitizeMobileNumber(val: string, prev = ""): string {
  let digits = val.replace(/\D/g, "")
  if (!digits) return ""

  // Normalize international +639... -> 09...
  if (digits.startsWith("639")) {
    digits = "09" + digits.slice(3)
  } else if (digits.startsWith("9")) {
    // If entered without leading 0 (e.g. 917...) -> 0917...
    digits = "0" + digits
  } else if (!digits.startsWith("0")) {
    // If entered starting with another digit (e.g. 1...) -> 091...
    digits = "09" + digits
  }

  // Length 1: user typed '0'
  if (digits.length === 1) {
    return digits === "0" ? "0" : "09"
  }

  // Length >= 2: must start with '09'
  if (!digits.startsWith("09")) {
    return prev.startsWith("09") ? prev : "09"
  }

  return digits.slice(0, MOBILE_NUMBER_LENGTH)
}

export const SUFFIX_OPTIONS = [
  { value: "none", label: "None" },
  { value: "Jr.", label: "Jr." },
  { value: "Sr.", label: "Sr." },
  { value: "II", label: "II" },
  { value: "III", label: "III" },
  { value: "IV", label: "IV" },
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

// Default to 1 row with empty fields so users select from the item/unit dropdowns.
export const DEFAULT_BUDGET_ITEMS: BudgetItem[] = [
  { id: "1", item: "", unit: "", quantity: "", pricePerUnit: "" },
]

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim())
}

export function saafStepHasUserInput(
  step: SaafStepIndex,
  draft: SaafDraft
): boolean {
  switch (step) {
    case 0:
      return (
        draft.activityType !== DEFAULT_SAAF_DRAFT.activityType ||
        filled(draft.totalOrgMembers)
      )
    case 1: {
      if (draft.dependentOrgs.length > 0) return true
      if (Object.values(draft.departmentValues).some(filled)) return true
      if (draft.proponents.length !== 1) return true
      const proponent = draft.proponents[0]
      if (!proponent) return false
      return [
        proponent.position,
        proponent.firstName,
        proponent.middleName,
        proponent.lastName,
        proponent.suffix,
        proponent.studentNumber,
        proponent.programAndYear,
        proponent.department,
        proponent.positionOfApplicant,
        proponent.contactNumber,
        proponent.emailAddress,
        proponent.facebookLink,
      ].some(filled)
    }
    case 2:
      return [
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
        draft.expectedParticipants,
        draft.individualContribution,
        draft.proposedBudget,
        draft.dayOfEvent,
      ].some(filled)
    case 3:
      if (draft.mission1 || draft.mission2 || draft.mission3) return true
      if (
        [
          draft.coreValuesExplanation,
          draft.peoExplanation,
          draft.sdgExplanation,
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
    default:
      return false
  }
}

export function saafHasUserInput(draft: SaafDraft): boolean {
  return ([0, 1, 2, 3] as const).some((s) => saafStepHasUserInput(s, draft))
}

export function getClearedFieldsForSaafStep(
  step: SaafStepIndex
): Partial<SaafDraft> {
  switch (step) {
    case 0:
      return {
        activityType: DEFAULT_SAAF_DRAFT.activityType,
        totalOrgMembers: DEFAULT_SAAF_DRAFT.totalOrgMembers,
      }
    case 1:
      return {
        proponents: [createEmptyProponent("1")],
        departmentValues: {},
        dependentOrgs: [],
      }
    case 2:
      return {
        activityTitle: "",
        activityDescription: "",
        activityObjectives: "",
        activityVenue: "",
        dateOfEvent: "",
        endDateOfEvent: "",
        timeOfEvent: "",
        timeOfEventStart: "",
        timeOfEventEnd: "",
        timeOfEventStartHour: "",
        timeOfEventStartMinute: "",
        timeOfEventStartPeriod: "",
        timeOfEventEndHour: "",
        timeOfEventEndMinute: "",
        timeOfEventEndPeriod: "",
        expectedParticipants: "",
        individualContribution: "",
        proposedBudget: "",
        dayOfEvent: "",
      }
    case 3:
      return {
        mission1: false,
        mission2: false,
        mission3: false,
        coreValuesExplanation: "",
        peoExplanation: "",
        sdgExplanation: "",
        budgetItems: DEFAULT_BUDGET_ITEMS,
      }
    default:
      return {}
  }
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
  dependentOrgs: [],
}