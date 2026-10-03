import type {
  ApiOrganization,
  ApiSignatory,
  ApiSignatoryRole,
  OrganizationAssignableDeskRole,
  OrganizationDeskRole,
  SharedSignatoryRole,
} from "@/lib/dynamodb-adapters"

export const SIGNATORY_ROLE_ITEMS = [
  { label: "Dean", value: "dean" },
  { label: "Adviser", value: "adviser" },
  { label: "Admin", value: "admin" },
  { label: "CDM", value: "cdm" },
  { label: "OSAAR", value: "osaar" },
] as const

export const ORGANIZATION_ASSIGNABLE_DESK_ITEMS = [
  { label: "Dean", value: "dean" },
  { label: "Adviser", value: "adviser" },
] as const

export const SHARED_SIGNATORY_ROLE_ITEMS = [
  { label: "Admin", value: "admin" },
  { label: "CDM", value: "cdm" },
  { label: "OSAAR", value: "osaar" },
] as const

export const SINGLETON_SIGNATORY_ROLES: readonly ApiSignatoryRole[] = [
  "admin",
  "cdm",
  "osaar",
]

export type SignatoryRoleValue = ApiSignatory["role"]

export type SignatoryOption = { label: string; value: string }

const ROLE_ORDER = Object.fromEntries(
  SIGNATORY_ROLE_ITEMS.map((item, index) => [item.value, index])
) as Record<SignatoryRoleValue, number>

export function signatoryRoleLabel(role: string): string {
  const match = SIGNATORY_ROLE_ITEMS.find((item) => item.value === role)
  return match?.label ?? role
}

export function roleFromCognitoGroups(groups: string[]): ApiSignatoryRole | undefined {
  if (groups.includes("CDM_Reviewer")) return "cdm"
  if (groups.includes("Dean")) return "dean"
  if (groups.includes("ORG_Adviser")) return "adviser"
  if (groups.includes("OSAAR")) return "osaar"
  if (groups.includes("Admin")) return "admin"
  return undefined
}

export function optionsForRole(
  people: ApiSignatory[],
  role: OrganizationDeskRole
): SignatoryOption[] {
  return people
    .filter((person) => person.role === role)
    .map((person) => ({
      label: person.name,
      value: person.signatory_id,
    }))
}

export function findByRole(
  people: ApiSignatory[],
  role: ApiSignatoryRole
): ApiSignatory | undefined {
  return people.find((person) => person.role === role)
}

export function missingSharedRoles(people: ApiSignatory[]): SharedSignatoryRole[] {
  return SHARED_SIGNATORY_ROLE_ITEMS.filter(
    (item) => !people.some((person) => person.role === item.value)
  ).map((item) => item.value)
}

export function takenSingletonRoles(
  people: ApiSignatory[],
  exceptId?: string
): Set<ApiSignatoryRole> {
  return new Set(
    people
      .filter(
        (person) =>
          person.signatory_id !== exceptId &&
          SINGLETON_SIGNATORY_ROLES.includes(person.role)
      )
      .map((person) => person.role)
  )
}

export function resolveSignatoryByRole(
  people: ApiSignatory[],
  role: OrganizationAssignableDeskRole,
  value: string
): { match?: ApiSignatory; ambiguous: boolean } {
  const needle = value.trim().toLowerCase()
  const matches = people.filter(
    (person) =>
      person.role === role &&
      (person.signatory_id.toLowerCase() === needle ||
        person.name.toLowerCase() === needle)
  )

  if (matches.length > 1) {
    return { ambiguous: true }
  }

  return { match: matches[0], ambiguous: false }
}

export function compareSignatoriesByRole(
  a: ApiSignatory,
  b: ApiSignatory
): number {
  const orderDiff =
    (ROLE_ORDER[a.role] ?? Number.MAX_SAFE_INTEGER) -
    (ROLE_ORDER[b.role] ?? Number.MAX_SAFE_INTEGER)
  if (orderDiff !== 0) {
    return orderDiff
  }
  return a.name.localeCompare(b.name)
}

export function deskAssignment(
  org: ApiOrganization,
  role: OrganizationDeskRole
): string | undefined {
  return org.signatories?.find((desk) => desk.role === role)?.signatory_id
}

export function optionFromPerson(
  person?: ApiSignatory
): SignatoryOption | null {
  if (!person) {
    return null
  }
  return { label: person.name, value: person.signatory_id }
}
