/** Letter-only copy. The forms reject digits in names and flag nonsense text. */
export const PROSE =
  "This activity develops leadership and service among members while keeping the work aligned with the university mission and goals."

export const RETURN_COMMENT = "Please revise this section before the next review."
export const DENY_COMMENT = "This proposal is denied after review of the activity plan."
export const ROOM_PURPOSE = "Room purpose for the end to end reservation check."
export const EQUIPMENT_REMARK = "Projector for the plenary session."

/**
 * Desk contact details recorded for the first adviser. The proponent's
 * Signatories tab reads them back off the desk holding the paper, so one desk in
 * the run carries them and the rest prove the empty state.
 */
export const DESK_CONTACT = {
  email: "adviser.alpha@mapua.edu.ph",
  office: "Room 204, YC Building",
  number: "(02) 8888 0001",
} as const

export const SLOT_START = [
  "7:00 AM",
  "8:10 AM",
  "9:20 AM",
  "10:30 AM",
  "11:40 AM",
  "12:50 PM",
  "2:00 PM",
  "3:10 PM",
  "4:20 PM",
  "5:30 PM",
  "6:40 PM",
  "7:50 PM",
] as const

export const SLOT_END = [
  "8:10 AM",
  "9:20 AM",
  "10:30 AM",
  "11:40 AM",
  "12:50 PM",
  "2:00 PM",
  "3:10 PM",
  "4:20 PM",
  "5:30 PM",
  "6:40 PM",
  "7:50 PM",
  "9:00 PM",
] as const

export function freeSlotName(slot: number): RegExp {
  return new RegExp(`${SLOT_START[slot]}[-–—]${SLOT_END[slot]}`)
}

export const STUDENT_NUMBERS = {
  stu1: "2026100001",
  stu2: "2026100002",
  unregistered: "2026100003",
  proponent: "2026100101",
} as const

export function personName(role: string, tag: string): string {
  const names: Record<string, string> = {
    adv1: "Adviser Alpha",
    adv2: "Adviser Bravo",
    adv3: "Adviser Charlie",
    dean1: "Dean Sierra",
    dean2: "Dean Echo",
    osaar1: "Osaar One",
    osaar2: "Osaar Two",
    osaarAll: "Osaar All",
    cdm1: "Cdm Reviewer",
  }
  return `${names[role]} ${tag}`
}

export function orgName(key: string, tag: string): string {
  const names: Record<string, string> = {
    orgA: "Org Alpha",
    orgB: "Org Bravo",
    orgC: "Org Charlie",
  }
  return `${names[key]} ${tag}`
}

export function campusName(tag: string): string {
  return `Campus ${tag}`
}

/** Visible desk labels. OSAAR stages collapse to the role; order is what matters. */
export function normalizeDesk(label: string): string {
  const trimmed = label.trim()
  if (/OSAAR/i.test(trimmed)) return "OSAAR"
  return trimmed
}
