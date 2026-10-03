export const DEPARTMENTS = [
  { code: "SOIT", name: "School of Information Technology" },
  { code: "SEECE", name: "School of EE-ECE-COE" },
  { code: "CEGE", name: "School of Civil, Environmental and Geological Engineering" },
  { code: "CBMES", name: "School of Chemical, Biological and Materials Engineering" },
  { code: "ME-MME", name: "School of Mechanical and Manufacturing Engineering" },
  { code: "SMS", name: "School of Media Studies" },
  { code: "SLA", name: "School of Liberal Arts" },
  { code: "ETYSB", name: "E.T. Yuchengco School of Business" },
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
  return match?.code ?? needle
}
