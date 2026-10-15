import type { KeyboardEvent } from "react"

export const SIGNATORY_NAME_MIN = 3
export const SIGNATORY_NAME_MAX = 30

export const SIGNATORY_NAME_LENGTH_ERROR =
  "The required minimum character is 3 and a maximum of 30"

export const SIGNATORY_NAME_DOT_ERROR =
  "You cannot start with a special character ."

export const SIGNATORY_NAME_CHARS_ERROR =
  "Signatory name can only contain letters, spaces, and non-initial periods."

const INVALID_SIGNATORY_NAME = /[^\p{L}\s.]|\d/u

/** First submit error for a signatory name. Empty is left to the role check. */
export function signatoryNameError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return null
  }
  if (name.startsWith(".")) {
    return SIGNATORY_NAME_DOT_ERROR
  }
  if (
    trimmed.length < SIGNATORY_NAME_MIN ||
    trimmed.length > SIGNATORY_NAME_MAX
  ) {
    return SIGNATORY_NAME_LENGTH_ERROR
  }
  if (INVALID_SIGNATORY_NAME.test(trimmed)) {
    return SIGNATORY_NAME_CHARS_ERROR
  }
  return null
}

/** Live hints that match the add form: leading dot, then length. */
export function signatoryNameLiveErrors(name: string): string[] {
  const errors: string[] = []
  if (name.startsWith(".")) {
    errors.push(SIGNATORY_NAME_DOT_ERROR)
  }
  const trimmed = name.trim()
  if (
    name.length > 0 &&
    (trimmed.length < SIGNATORY_NAME_MIN ||
      trimmed.length > SIGNATORY_NAME_MAX)
  ) {
    errors.push(SIGNATORY_NAME_LENGTH_ERROR)
  }
  return errors
}

export function isSignatoryNameValid(name: string): boolean {
  const trimmed = name.trim()
  return (
    trimmed.length >= SIGNATORY_NAME_MIN &&
    trimmed.length <= SIGNATORY_NAME_MAX &&
    !name.startsWith(".") &&
    !INVALID_SIGNATORY_NAME.test(name)
  )
}

/**
 * Prevents typing numbers and special characters in signatory name.
 * Allows letters (including unicode), spaces, and dot (.).
 */
export function blockInvalidSignatoryNameKeys(
  event: KeyboardEvent<HTMLInputElement>
) {
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
    return
  }
  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault()
    return
  }
  if (event.key === ".") {
    return
  }
  if (!/^[\p{L}\s]$/u.test(event.key)) {
    event.preventDefault()
  }
}

/** Removes digits and special characters except '.', and caps at 30 characters. */
export function sanitizeSignatoryName(value: string): string {
  return value.replace(/[^\p{L}\s.]/gu, "").slice(0, SIGNATORY_NAME_MAX)
}
