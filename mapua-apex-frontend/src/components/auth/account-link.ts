/** Cognito claims that link an account to one desk. Admin accounts are exempt. */
const SIGNATORY_CLAIM_KEYS = ["custom:signatory_id", "signatory_id"] as const
const ORGANIZATION_CLAIM_KEYS = [
  "custom:organization_id",
  "organization_id",
] as const

function claimValue(
  profile: Record<string, unknown> | undefined,
  keys: readonly string[]
): string {
  if (!profile) return ""
  for (const key of keys) {
    const value = profile[key]
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim()
    }
  }
  return ""
}

export function hasSignatoryOrOrganizationId(
  profile: Record<string, unknown> | undefined
): boolean {
  return (
    claimValue(profile, SIGNATORY_CLAIM_KEYS) !== "" ||
    claimValue(profile, ORGANIZATION_CLAIM_KEYS) !== ""
  )
}

export function isPrivilegedAccount(groups: readonly string[]): boolean {
  return groups.some((group) => {
    const name = group.toLowerCase()
    return name === "admin" || name === "super_admin"
  })
}
