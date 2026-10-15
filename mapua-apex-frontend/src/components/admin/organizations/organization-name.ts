import type { KeyboardEvent } from "react"

export const ORGANIZATION_NAME_MIN = 5
export const ORGANIZATION_NAME_MAX = 100

export const ORGANIZATION_NAME_REQUIRED_ERROR = "Organization name is required."

export const ORGANIZATION_NAME_LENGTH_ERROR =
  "The required minimum character is 5 and a maximum of 100"

export const ORGANIZATION_NAME_DIGITS_ERROR =
  "Organization name cannot contain numbers."

/** First submit error for an organization name, or null when it can be saved. */
export function organizationNameError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return ORGANIZATION_NAME_REQUIRED_ERROR
  }
  if (
    trimmed.length < ORGANIZATION_NAME_MIN ||
    trimmed.length > ORGANIZATION_NAME_MAX
  ) {
    return ORGANIZATION_NAME_LENGTH_ERROR
  }
  if (/[0-9]/.test(trimmed)) {
    return ORGANIZATION_NAME_DIGITS_ERROR
  }
  return null
}

/** Length hint while typing. Empty input stays quiet until submit. */
export function organizationNameLiveError(name: string): string | null {
  if (name.length === 0) {
    return null
  }
  const trimmed = name.trim()
  if (
    trimmed.length < ORGANIZATION_NAME_MIN ||
    trimmed.length > ORGANIZATION_NAME_MAX
  ) {
    return ORGANIZATION_NAME_LENGTH_ERROR
  }
  return null
}

export function isOrganizationNameValid(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= ORGANIZATION_NAME_MIN &&
    trimmed.length <= ORGANIZATION_NAME_MAX &&
    !/[0-9]/.test(name)
  )
}

export function blockOrganizationNameDigitKeys(
  event: KeyboardEvent<HTMLInputElement>
) {
  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault()
  }
}

export function sanitizeOrganizationName(value: string): string {
  return value.replace(/[0-9]/g, "").slice(0, ORGANIZATION_NAME_MAX)
}
