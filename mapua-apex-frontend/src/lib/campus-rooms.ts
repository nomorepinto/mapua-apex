import { isCampus, type Campus } from "@/components/submission/constants"

/** Room row that takes a free-text classroom code instead of a fixed room. */
export const CLASSROOM_ROOM = "Classroom"

/** Fixed, pre-named rooms each campus lends out. */
const FIXED_ROOMS: Record<Campus, string[]> = {
  "Makati Campus": [
    "Cardinal Cinema",
    "Cervantes Room",
    "Makati Campus Lobby",
    "Global Classroom",
  ],
  "Intramuros Campus": ["AV Room", "Seminar Room", "Global Classroom"],
}

/**
 * Classroom code format per campus: Makati codes are `MPO` + 3 digits, and
 * Intramuros codes are a compass direction (N, W, S, E, NW, NE, SW, SE) + 3
 * digits. Two-letter directions are listed first so they win the alternation.
 */
const CLASSROOM_PATTERN: Record<Campus, RegExp> = {
  "Makati Campus": /^MPO\d{3}$/,
  "Intramuros Campus": /^(?:NW|NE|SW|SE|N|W|S|E)\d{3}$/,
}

const CLASSROOM_FORMAT: Record<Campus, string> = {
  "Makati Campus": "MPO + 3 digits (e.g. MPO101)",
  "Intramuros Campus": "N, W, S, E, NW, NE, SW or SE + 3 digits (e.g. N101, SW204)",
}

const CLASSROOM_EXAMPLE: Record<Campus, string> = {
  "Makati Campus": "MPO101",
  "Intramuros Campus": "N101",
}

/** Longest valid code: `MPO` + 3 digits, or a 2-letter direction + 3 digits. */
const CLASSROOM_MAX_LENGTH = 6

/**
 * Rooms the reservation step offers for the SAAF venue campus: that campus's
 * fixed rooms plus "Classroom". Returns nothing when no campus (or an
 * unrecognized one) is selected — the venue field on step 3 is the only source.
 */
export function roomOptionsForCampus(campus: string): string[] {
  return isCampus(campus) ? [...FIXED_ROOMS[campus], CLASSROOM_ROOM] : []
}

/** Whether a room row picked earlier is still offered by `campus`. */
export function isRoomOfferedAtCampus(
  campus: string,
  roomNeeded: string
): boolean {
  return roomOptionsForCampus(campus).includes(roomNeeded)
}

export function isValidClassroomName(campus: string, name: string): boolean {
  return isCampus(campus) && CLASSROOM_PATTERN[campus].test(name.trim())
}

export function classroomFormatFor(campus: string): string {
  return isCampus(campus) ? CLASSROOM_FORMAT[campus] : ""
}

export function classroomExampleFor(campus: string): string {
  return isCampus(campus) ? CLASSROOM_EXAMPLE[campus] : ""
}

/** Classroom codes are uppercase alphanumerics, so input is normalized as typed. */
export function sanitizeClassroomName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CLASSROOM_MAX_LENGTH)
}

/** Terms printed under the room table so the picker and codes stay documented. */
export function campusRoomTerms(campus: string): string[] {
  if (!isCampus(campus)) return []
  return [
    `${campus} rooms: ${FIXED_ROOMS[campus].join(", ")}.`,
    `${CLASSROOM_ROOM}: a code in the format ${CLASSROOM_FORMAT[campus]}.`,
  ]
}
