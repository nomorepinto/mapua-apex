export const DEPARTMENTS = [
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
  { code: "SOIT", name: "School of Information Technology" },
  { code: "SMDA", name: "School of Multimedia and Digital Arts" },
  { code: "ETYSB", name: "E.T. Yuchengco School of Business" },
  { code: "SHS-HEALTH", name: "School of Health Sciences" },
  { code: "SON", name: "School of Nursing" },
  { code: "SOM", name: "School of Medicine" },
  { code: "SHS-MAKATI", name: "SHS (Makati)" },
  { code: "STHM", name: "School of Tourism and Hospitality Management" },
] as const

export type DepartmentCode = (typeof DEPARTMENTS)[number]["code"]

export const DEPARTMENT_ITEMS = DEPARTMENTS.map((department) => ({
  label: `${department.code} — ${department.name}`,
  value: department.code,
}))

export function normalizeDepartment(value: string): string {
  return value.trim().toUpperCase()
}

export function departmentLabel(code: string): string {
  const needle = normalizeDepartment(code)
  if (!needle) {
    return "—"
  }
  const match = DEPARTMENTS.find((department) => department.code === needle)
  return match ? `${match.code} — ${match.name}` : needle
}

export function resolveDepartment(value: string): string | null {
  const needle = normalizeDepartment(value)
  if (!needle) {
    return null
  }
  const match = DEPARTMENTS.find(
    (department) =>
      department.code === needle ||
      department.name.toUpperCase() === needle
  )
  if (match) return match.code

  const legacyAliases: Record<string, string> = {
    SEECE: "EECE",
    "ME-MME": "MME",
    SMS: "SMDA",
    SLA: "DLA",
  }
  if (legacyAliases[needle]) return legacyAliases[needle]

  return needle
}

/**
 * Reduces a department value to just its abbreviation/code. The SAAF proponent
 * picker stores the full label with the code in trailing parentheses (e.g.
 * "School of Information Technology (SOIT)"), so that code is extracted when
 * present; otherwise a bare code or full school name is resolved through
 * resolveDepartment. Empty or placeholder values yield "—".
 */
export function departmentAbbreviation(
  value: string | null | undefined
): string {
  const trimmed = (value ?? "").trim()
  if (!trimmed || trimmed === "—") return "—"
  const parenthesized = trimmed.match(/\(([^)]+)\)\s*$/)
  if (parenthesized) return parenthesized[1].trim().toUpperCase()
  return resolveDepartment(trimmed) || trimmed.toUpperCase()
}
