export const CAMPUS_NAME_MIN = 5
export const CAMPUS_NAME_MAX = 150

export const CAMPUS_NAME_REQUIRED_ERROR = "Campus name is required."

export const CAMPUS_NAME_LENGTH_ERROR =
  "The required minimum character is 5 and a maximum of 150"

/** First submit error for a campus name, or null when it can be saved. */
export function campusNameError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return CAMPUS_NAME_REQUIRED_ERROR
  }
  if (
    trimmed.length < CAMPUS_NAME_MIN ||
    trimmed.length > CAMPUS_NAME_MAX
  ) {
    return CAMPUS_NAME_LENGTH_ERROR
  }
  return null
}

/** Length hint while typing. Empty input stays quiet until submit. */
export function campusNameLiveError(name: string): string | null {
  if (name.length === 0) {
    return null
  }
  const trimmed = name.trim()
  if (
    trimmed.length < CAMPUS_NAME_MIN ||
    trimmed.length > CAMPUS_NAME_MAX
  ) {
    return CAMPUS_NAME_LENGTH_ERROR
  }
  return null
}

export function isCampusNameValid(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= CAMPUS_NAME_MIN &&
    trimmed.length <= CAMPUS_NAME_MAX
  )
}

export function sanitizeCampusName(value: string): string {
  return value.slice(0, CAMPUS_NAME_MAX)
}
