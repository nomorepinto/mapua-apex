/**
 * Authentication Form Validation Utilities
 */

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
  allValid: boolean
}

/**
 * Validates email format with descriptive, user-friendly live guidance and examples.
 */
export function validateEmailLive(email: string): string | null {
  const trimmed = email.trim()

  if (!trimmed) {
    return null // Empty state is handled separately (required on submit / touched)
  }

  if (!trimmed.includes("@")) {
    return "Email must include an '@' symbol (e.g., user@example.com or name@mymail.mapua.edu.ph)."
  }

  const parts = trimmed.split("@")
  if (parts.length > 2) {
    return "Email cannot contain multiple '@' symbols (e.g., user@example.com)."
  }

  const [localPart, domainPart] = parts

  if (!localPart || localPart.trim() === "") {
    return "Please enter a name before the '@' (e.g., user@example.com)."
  }

  if (!domainPart || domainPart.trim() === "") {
    return "Please enter a domain after the '@' (e.g., example.com or mymail.mapua.edu.ph)."
  }

  if (!domainPart.includes(".")) {
    return "Please include a domain extension like .com or .edu.ph after the '@' (e.g., user@example.com)."
  }

  const domainParts = domainPart.split(".")
  if (domainParts.some((p) => p.length === 0)) {
    return "Please complete the domain name and extension (e.g., user@example.com)."
  }

  const tld = domainParts[domainParts.length - 1]
  if (tld.length < 2) {
    return "Please enter a valid top-level domain extension like .com or .ph (e.g., user@example.com)."
  }

  // General format check
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!validEmailRegex.test(trimmed)) {
    return "Please enter a valid email address (e.g., user@example.com)."
  }

  return null
}

/**
 * Validates full name requirements: minimum 8 characters, maximum 35 characters.
 */
export function validateFullName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null

  if (trimmed.length < 8) {
    return `Full name must be at least 8 characters (currently ${trimmed.length}/8).`
  }

  if (trimmed.length > 35) {
    return `Full name cannot exceed 35 characters (currently ${trimmed.length}/35).`
  }

  return null
}

/**
 * Checks password against security requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  const minLength = password.length >= 8
  const hasUppercase = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)

  return {
    minLength,
    hasUppercase,
    hasNumber,
    hasSpecialChar,
    allValid: minLength && hasUppercase && hasNumber && hasSpecialChar,
  }
}
