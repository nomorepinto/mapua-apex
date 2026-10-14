import type { ApiCampus } from "@/lib/types"

/**
 * Classroom naming rules carried on a campus (`classroom_name_prefixes` +
 * `classroom_name_digits`).
 *
 * Mirrors backend `CampusClassroomNaming`: a campus may define how its
 * classroom rooms are named — a set of allowed prefix tokens plus one required
 * digit count — and a room flagged classroom must be named exactly
 * "<one prefix><N digits>" (case-insensitive). Campuses without a format
 * enforce nothing and cannot host classroom rooms. Keeping the logic here means
 * the CDM form blocks a bad name before submit instead of eating a 422.
 */

export const MAX_PREFIXES = 30
export const MAX_DIGITS = 4

/** A prefix token is 1-10 letters. */
export function isValidPrefixToken(token: string): boolean {
  return /^[A-Za-z]{1,10}$/.test(token)
}

/** Uppercase, trim, drop empties and duplicates; keep insertion order. */
export function normalizePrefixes(prefixes: readonly unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const prefix of prefixes) {
    if (typeof prefix !== "string") continue
    const token = prefix.trim().toUpperCase()
    if (token === "" || seen.has(token)) continue
    seen.add(token)
    result.push(token)
  }

  return result
}

/**
 * Parse a free-text token list (comma and/or whitespace separated) into
 * normalized prefix tokens.
 */
export function parsePrefixTokens(text: string): string[] {
  return normalizePrefixes(text.split(/[,\s]+/))
}

function digitsOf(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

/** Whether a campus defines a usable classroom naming format. */
export function campusHasClassroomFormat(
  campus?: Pick<ApiCampus, "classroom_name_prefixes" | "classroom_name_digits"> | null
): boolean {
  if (!campus) return false
  return normalizePrefixes(campus.classroom_name_prefixes ?? []).length > 0 && digitsOf(campus.classroom_name_digits) !== null
}

/**
 * Regex matching "<one prefix><exactly N digits>" (case-insensitive), or null
 * when no usable format is supplied.
 */
export function classroomNameRegex(prefixes?: readonly string[] | null, digits?: number | null): RegExp | null {
  const normalized = normalizePrefixes(prefixes ?? [])
  const count = digitsOf(digits)
  if (normalized.length === 0 || count === null || count < 1) return null

  const alternation = normalized.map(escapeRegExp).join("|")
  return new RegExp(`^(?:${alternation})\\d{${count}}$`, "i")
}

/** Whether a classroom name matches the format. False when no format is supplied. */
export function matchesClassroomName(
  prefixes: readonly string[] | null | undefined,
  digits: number | null | undefined,
  name: string
): boolean {
  const pattern = classroomNameRegex(prefixes ?? [], digitsOf(digits ?? null))
  if (!pattern) return false
  return pattern.test(name.trim())
}

/** Human description of the required format, or null when none is set. */
export function classroomFormatHint(
  prefixes?: readonly string[] | null,
  digits?: number | null
): string | null {
  const normalized = normalizePrefixes(prefixes ?? [])
  const count = digitsOf(digits)
  if (normalized.length === 0 || count === null) return null
  return `${normalized.join(" / ")} followed by exactly ${count} ${count === 1 ? "digit" : "digits"}`
}

/**
 * Concrete example names for a live hint (e.g. "MPO111, NW111") parsed from raw
 * text inputs. Returns "" when the format is incomplete or out of range.
 */
export function classroomExampleNames(prefixesText: string, digitsText: string): string {
  const prefixes = parsePrefixTokens(prefixesText)
  const count = digitsOf(digitsText)
  if (prefixes.length === 0 || count === null || count < 1 || count > MAX_DIGITS) {
    return ""
  }
  return prefixes
    .slice(0, 2)
    .map((prefix) => `${prefix}${"1".repeat(count)}`)
    .join(", ")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
