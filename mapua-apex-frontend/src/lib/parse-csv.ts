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
}

export type OrganizationCsvRow = {
  name: string
  desks: Record<OrganizationAssignableDeskRole, string>
  is_higher_council: boolean
}

const ROLE_ALIASES: Record<string, SignatoryRole> = {
  adviser: "adviser",
  advisor: "adviser",
  admin: "admin",
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

const HIGHER_COUNCIL_ALIASES = [
  "is_higher_council",
  "ishighercouncil",
  "higher_council",
  "higher council",
  "highercouncil",
]

export function parseSignatoryRole(value: string): SignatoryRole | null {
  return ROLE_ALIASES[value.trim().toLowerCase()] ?? null
}

function headerIndex(header: string[], aliases: string[]): number {
  return header.findIndex((cell) => isHeaderCell(cell, aliases))
}

/**
 * Parse a signatory CSV of name, role, and optional department.
 * Department is stored only for deans. A header row is optional.
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
    headerIndex(first, ["department", "dept"]) >= 0
  const header = hasHeader ? first : ["name", "role", "department"]
  const start = hasHeader ? 1 : 0
  const nameIdx = Math.max(0, headerIndex(header, ["name"]))
  const roleIdx =
    headerIndex(header, ["role"]) >= 0 ? headerIndex(header, ["role"]) : 1
  const deptIdx = headerIndex(header, ["department", "dept"])

  const records: SignatoryCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameIdx]?.trim() ?? ""
    const roleRaw = row[roleIdx]?.trim() ?? ""
    const departmentRaw =
      deptIdx >= 0 ? (row[deptIdx]?.trim() ?? "") : (row[2]?.trim() ?? "")
    const line = i + 1

    if (!name && !roleRaw && !departmentRaw) {
      continue
    }

    const role = parseSignatoryRole(roleRaw)
    if (!name || !role) {
      errors.push(
        `Row ${line}: expected name and role (dean | adviser | admin | cdm | osaar).`
      )
      continue
    }

    const record: SignatoryCsvRow = { name, role }
    if (role === "dean" && departmentRaw) {
      record.department = resolveDepartment(departmentRaw) ?? undefined
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

/**
 * Parse an organization CSV.
 * Columns: name, dean, adviser, is_higher_council. A header row is optional.
 * The dean column may be left empty for higher-council rows (they skip the
 * dean desk). Shared admin / CDM / OSAAR desks are not in the file.
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
  const header = hasHeader ? first : ["name", "dean", "adviser", "is_higher_council"]
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
  const higherCouncilIdx = headerIndex(header, HIGHER_COUNCIL_ALIASES)

  const parsed: OrganizationCsvRow[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]
    const name = row[nameIdx]?.trim() ?? ""
    const desks = {
      dean: row[deskIdx.dean]?.trim() ?? "",
      adviser: row[deskIdx.adviser]?.trim() ?? "",
    }
    const flagRaw =
      higherCouncilIdx >= 0
        ? (row[higherCouncilIdx]?.trim() ?? "")
        : hasHeader
          ? ""
          : (row[3]?.trim() ?? "")
    const line = i + 1

    if (!name && !desks.dean && !desks.adviser && !flagRaw) {
      continue
    }

    const isHigherCouncil = parseCsvBoolean(flagRaw)
    if (isHigherCouncil === null) {
      errors.push(
        `Row ${line}: is_higher_council must be true, false, yes, no, 1, or 0.`
      )
      continue
    }

    // Higher councils skip the dean desk, so their dean column may be empty.
    const required = ORGANIZATION_CSV_COLUMNS.filter(
      (role) => role !== "dean" || !isHigherCouncil
    )
    const missing = required.filter((role) => !desks[role])
    if (!name || missing.length > 0) {
      errors.push(
        isHigherCouncil
          ? `Row ${line}: expected name and adviser.`
          : `Row ${line}: expected name, dean, and adviser.`
      )
      continue
    }

    parsed.push({ name, desks, is_higher_council: isHigherCouncil })
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

export function downloadCsvTemplate(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
