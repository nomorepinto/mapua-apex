import type {
  ApiSignatoryRole,
  OrganizationAssignableDeskRole,
} from "@/lib/dynamodb-adapters"
import type { ReservableType } from "@/lib/types"
import { resolveDepartment } from "@/lib/departments"

/** Split CSV text into trimmed rows, honoring quoted commas and BOM. */
export function parseCsvRows(text: string): string[][] {
  const input = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")

  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ",") {
      row.push(cell.trim())
      cell = ""
      continue
    }

    if (ch === "\n") {
      row.push(cell.trim())
      if (row.some((value) => value.length > 0)) {
        rows.push(row)
      }
      row = []
      cell = ""
      continue
    }

    cell += ch
  }

  row.push(cell.trim())
  if (row.some((value) => value.length > 0)) {
    rows.push(row)
  }

  return rows
}

function isHeaderCell(value: string, aliases: string[]): boolean {
  return aliases.includes(value.trim().toLowerCase())
}

/**
 * Read a one-column CSV of names. Skips a header row like `name` / `organization`.
 */
export function parseSingleColumnCsv(
  text: string,
  headerAliases: string[] = ["name", "organization", "organization_id", "org"]
): string[] {
  const rows = parseCsvRows(text)
  if (rows.length === 0) {
    return []
  }

  const start = isHeaderCell(rows[0][0] ?? "", headerAliases) ? 1 : 0
  const values: string[] = []
  const seen = new Set<string>()

  for (let i = start; i < rows.length; i++) {
    const value = rows[i][0]?.trim()
    if (!value) {
      continue
    }

    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    values.push(value)
  }

  return values
}

export type SignatoryRole = ApiSignatoryRole

export type SignatoryCsvRow = {
  name: string
  role: SignatoryRole
  department?: string
  /** Campus name, or `all` for the account that receives every campus. */
  campus?: string
}

export type OrganizationCsvRow = {
  name: string
  desks: Record<OrganizationAssignableDeskRole, string>
  skip_dean: boolean
  skip_post_eval: boolean
}

const ROLE_ALIASES: Record<string, SignatoryRole> = {
  adviser: "adviser",
  advisor: "adviser",
  cdm: "cdm",
  dean: "dean",
  osaar: "osaar",
}

const NAME_ALIASES = ["name", "organization", "organization_name", "org"]
const DESK_ALIASES: Record<OrganizationAssignableDeskRole, string[]> = {
  dean: ["dean"],
  adviser: ["adviser", "advisor"],
}

const ORGANIZATION_CSV_COLUMNS: OrganizationAssignableDeskRole[] = [
  "dean",
  "adviser",
]

const SKIP_DEAN_ALIASES = ["skip_dean", "skipdean", "skip dean"]
const SKIP_POST_EVAL_ALIASES = [
  "skip_post_eval",
  "skipposteval",
  "skip_posteval",
  "skip post-eval",
  "skip post eval",
  "skip_post_evaluation",
]

export function parseSignatoryRole(value: string): SignatoryRole | null {
  return ROLE_ALIASES[value.trim().toLowerCase()] ?? null
}

function headerIndex(header: string[], aliases: string[]): number {
  return header.findIndex((cell) => isHeaderCell(cell, aliases))
}

/**
 * Parse a signatory CSV of name, role, optional department, and optional campus.
 * Department is stored only for deans. An OSAAR row needs a campus name or `all`.
 * A header row is optional.
 */
export function parseSignatoryCsv(text: string): {
  records: SignatoryCsvRow[]
  errors: string[]
} {
  const rows = parseCsvRows(text)
  const errors: string[] = []

  if (rows.length === 0) {
    return { records: [], errors: ["CSV is empty."] }
  }

  const first = rows[0]
  const hasHeader =
    headerIndex(first, ["name"]) >= 0 ||
    headerIndex(first, ["role"]) >= 0 ||
    headerIndex(first, ["department", "dept"]) >= 0 ||
    headerIndex(first, ["campus"]) >= 0
  const header = hasHeader ? first : ["name", "role", "department", "campus"]
  const start = hasHeader ? 1 : 0
  const nameIdx = Math.max(0, headerIndex(header, ["name"]))
  const roleIdx =
    headerIndex(header, ["role"]) >= 0 ? headerIndex(header, ["role"]) : 1
  const deptIdx = headerIndex(header, ["department", "dept"])
  const campusIdx = headerIndex(header, ["campus"])

  const records: SignatoryCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameIdx]?.trim() ?? ""
    const roleRaw = row[roleIdx]?.trim() ?? ""
    const departmentRaw =
      deptIdx >= 0 ? (row[deptIdx]?.trim() ?? "") : (row[2]?.trim() ?? "")
    const campusRaw = campusIdx >= 0 ? (row[campusIdx]?.trim() ?? "") : ""
    const line = i + 1

    if (!name && !roleRaw && !departmentRaw && !campusRaw) {
      continue
    }

    const role = parseSignatoryRole(roleRaw)
    if (!name || !role) {
      errors.push(
        `Row ${line}: expected name and role (dean | adviser | cdm | osaar).`
      )
      continue
    }

    const record: SignatoryCsvRow = { name, role }
    if (role === "dean" && departmentRaw) {
      record.department = resolveDepartment(departmentRaw) ?? undefined
    }
    if (role === "osaar") {
      if (!campusRaw) {
        errors.push(`Row ${line}: an OSAAR signatory needs a campus or all.`)
        continue
      }
      record.campus = campusRaw
    }
    records.push(record)
  }

  return { records, errors }
}

function isOrganizationHeader(row: string[]): boolean {
  return headerIndex(row, NAME_ALIASES) === 0
}

function parseCsvBoolean(value: string): boolean | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === "") {
    return false
  }
  if (["true", "yes", "1", "y"].includes(normalized)) {
    return true
  }
  if (["false", "no", "0", "n"].includes(normalized)) {
    return false
  }
  return null
}

function csvFlagCell(
  header: string[],
  row: string[],
  aliases: string[],
  fallbackIndex: number,
  hasHeader: boolean
): string {
  const index = headerIndex(header, aliases)
  if (index >= 0) {
    return row[index]?.trim() ?? ""
  }
  if (hasHeader) {
    return ""
  }
  return row[fallbackIndex]?.trim() ?? ""
}

/**
 * Parse an organization CSV.
 * Columns: name, dean, adviser, skip_dean, skip_post_eval. A header row is
 * optional. The dean column may be left empty when skip_dean is true. Shared
 * CDM and OSAAR desks are not in the file.
 */
export function parseOrganizationCsv(text: string): {
  rows: OrganizationCsvRow[]
  errors: string[]
} {
  const rows = parseCsvRows(text)
  const errors: string[] = []

  if (rows.length === 0) {
    return { rows: [], errors: ["CSV is empty."] }
  }

  const first = rows[0]
  const hasHeader = isOrganizationHeader(first)
  const header = hasHeader
    ? first
    : ["name", "dean", "adviser", "skip_dean", "skip_post_eval"]
  const start = hasHeader ? 1 : 0

  const nameIdx =
    headerIndex(header, NAME_ALIASES) >= 0
      ? headerIndex(header, NAME_ALIASES)
      : 0
  const deskIdx: Record<OrganizationAssignableDeskRole, number> = {
    dean:
      headerIndex(header, DESK_ALIASES.dean) >= 0
        ? headerIndex(header, DESK_ALIASES.dean)
        : 1,
    adviser:
      headerIndex(header, DESK_ALIASES.adviser) >= 0
        ? headerIndex(header, DESK_ALIASES.adviser)
        : 2,
  }

  const parsed: OrganizationCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameIdx]?.trim() ?? ""
    const desks = {
      dean: row[deskIdx.dean]?.trim() ?? "",
      adviser: row[deskIdx.adviser]?.trim() ?? "",
    }
    const skipDeanRaw = csvFlagCell(header, row, SKIP_DEAN_ALIASES, 3, hasHeader)
    const skipPostEvalRaw = csvFlagCell(
      header,
      row,
      SKIP_POST_EVAL_ALIASES,
      4,
      hasHeader
    )
    const line = i + 1

    if (!name && !desks.dean && !desks.adviser && !skipDeanRaw && !skipPostEvalRaw) {
      continue
    }

    const skipDean = parseCsvBoolean(skipDeanRaw)
    const skipPostEval = parseCsvBoolean(skipPostEvalRaw)
    if (skipDean === null) {
      errors.push(
        `Row ${line}: skip_dean must be true, false, yes, no, 1, or 0.`
      )
      continue
    }
    if (skipPostEval === null) {
      errors.push(
        `Row ${line}: skip_post_eval must be true, false, yes, no, 1, or 0.`
      )
      continue
    }

    // A skip-dean row may leave the dean column empty.
    const required = ORGANIZATION_CSV_COLUMNS.filter(
      (role) => role !== "dean" || !skipDean
    )
    const missing = required.filter((role) => !desks[role])
    if (!name || missing.length > 0) {
      errors.push(
        skipDean
          ? `Row ${line}: expected name and adviser.`
          : `Row ${line}: expected name, dean, and adviser.`
      )
      continue
    }

    parsed.push({
      name,
      desks,
      skip_dean: skipDean,
      skip_post_eval: skipPostEval,
    })
  }

  return { rows: parsed, errors }
}

export type ReservableCsvRow = {
  name: string
  type: ReservableType
}

const RESERVABLE_TYPE_ALIASES: Record<string, ReservableType> = {
  room: "room",
  rooms: "room",
  "function room": "room",
  "function rooms": "room",
  equipment: "equipment",
  equipments: "equipment",
  av: "equipment",
  "audio-visual": "equipment",
  "audio visual": "equipment",
  audiovisual: "equipment",
}

export function parseReservableType(value: string): ReservableType | null {
  return RESERVABLE_TYPE_ALIASES[value.trim().toLowerCase()] ?? null
}

/**
 * Parse a reservable CSV of `name,type`. Type accepts room/equipment (plus a few
 * friendly aliases); the weekly schedule is NOT in the file — imported rows
 * default to all-available Mon-Sat and are edited afterwards on the grid.
 * A header row is optional.
 */
export function parseReservableCsv(text: string): {
  rows: ReservableCsvRow[]
  errors: string[]
} {
  const rows = parseCsvRows(text)
  const errors: string[] = []

  if (rows.length === 0) {
    return { rows: [], errors: ["CSV is empty."] }
  }

  const first = rows[0]
  const hasHeader =
    headerIndex(first, ["name"]) >= 0 || headerIndex(first, ["type"]) >= 0
  const header = hasHeader ? first : ["name", "type"]
  const start = hasHeader ? 1 : 0
  const nameIdx = headerIndex(header, ["name"]) >= 0 ? headerIndex(header, ["name"]) : 0
  const typeIdx = headerIndex(header, ["type"]) >= 0 ? headerIndex(header, ["type"]) : 1

  const parsed: ReservableCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameIdx]?.trim() ?? ""
    const typeRaw = row[typeIdx]?.trim() ?? ""
    const line = i + 1

    if (!name && !typeRaw) {
      continue
    }

    const type = parseReservableType(typeRaw)
    if (!name || !type) {
      errors.push(`Row ${line}: expected name and type (room | equipment).`)
      continue
    }

    parsed.push({ name, type })
  }

  return { rows: parsed, errors }
}

export type MemberCsvRow = {
  lastname: string
  firstname: string
  student_number: string
}

const MEMBER_LASTNAME_ALIASES = ["lastname", "last_name", "last name", "surname"]
const MEMBER_FIRSTNAME_ALIASES = ["firstname", "first_name", "first name", "given name"]
const MEMBER_STUDENT_NUMBER_ALIASES = ["student_number", "student number", "studentnumber", "student_id", "student id", "id"]

export const MEMBER_CSV_TEMPLATE = `lastname,firstname,student_number\nDela Cruz,Juan,202100001\nSantos,Maria,202100002\n`

/**
 * Parse a member CSV of lastname, firstname, student_number.
 * A header row is optional.
 */
export function parseMemberCsv(text: string): {
  rows: MemberCsvRow[]
  errors: string[]
} {
  const rows = parseCsvRows(text)
  const errors: string[] = []

  if (rows.length === 0) {
    return { rows: [], errors: ["CSV is empty."] }
  }

  const first = rows[0]
  const hasHeader =
    headerIndex(first, MEMBER_LASTNAME_ALIASES) >= 0 ||
    headerIndex(first, MEMBER_FIRSTNAME_ALIASES) >= 0 ||
    headerIndex(first, MEMBER_STUDENT_NUMBER_ALIASES) >= 0
  const header = hasHeader ? first : ["lastname", "firstname", "student_number"]
  const start = hasHeader ? 1 : 0

  const lastnameIdx =
    headerIndex(header, MEMBER_LASTNAME_ALIASES) >= 0
      ? headerIndex(header, MEMBER_LASTNAME_ALIASES)
      : 0
  const firstnameIdx =
    headerIndex(header, MEMBER_FIRSTNAME_ALIASES) >= 0
      ? headerIndex(header, MEMBER_FIRSTNAME_ALIASES)
      : 1
  const studentNumberIdx =
    headerIndex(header, MEMBER_STUDENT_NUMBER_ALIASES) >= 0
      ? headerIndex(header, MEMBER_STUDENT_NUMBER_ALIASES)
      : 2

  const parsed: MemberCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const lastname = row[lastnameIdx]?.trim() ?? ""
    const firstname = row[firstnameIdx]?.trim() ?? ""
    const studentNumber = row[studentNumberIdx]?.trim() ?? ""
    const line = i + 1

    if (!lastname && !firstname && !studentNumber) {
      continue
    }

    if (!lastname || !firstname || !studentNumber) {
      errors.push(`Row ${line}: expected lastname, firstname, and student_number.`)
      continue
    }

    parsed.push({ lastname, firstname, student_number: studentNumber })
  }

  return { rows: parsed, errors }
}

export function downloadCsvTemplate(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
