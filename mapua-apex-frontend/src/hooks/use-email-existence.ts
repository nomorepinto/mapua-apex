import { useCallback, useRef, useState } from "react"

import { apiClient } from "@/lib/api-client"
import { validateEmailDomain, validateEmailLive } from "@/lib/auth-validation"

/**
 * Mailbox-existence state surfaced to a single email field.
 * "unavailable" means the checker (or its backend proxy) could not answer;
 * forms treat that as non-blocking (fail open) so an outage never locks users out.
 */
export type EmailExistenceState = "idle" | "checking" | "valid" | "invalid" | "unavailable"

interface ValidateEmailResponse {
  state: "valid" | "invalid" | "domain_not_allowed" | "unavailable"
  score?: number
  did_you_mean?: string | null
  cached?: boolean
}

// Session-scoped cache so each distinct email costs at most one proxied
// EmailDetective lookup per page session (the credit-metered API is the cost).
const sessionCache = new Map<string, EmailExistenceState>()
const inFlight = new Map<string, Promise<EmailExistenceState>>()

async function fetchExistence(email: string): Promise<EmailExistenceState> {
  const cachedResult = sessionCache.get(email)
  if (cachedResult) return cachedResult

  const existing = inFlight.get(email)
  if (existing) return existing

  const promise = (async (): Promise<EmailExistenceState> => {
    try {
      const res = await apiClient.get<ValidateEmailResponse>("public/validate-email", {
        params: { email },
      })
      // conclusive states are cached; "unavailable" is retried on the next blur
      if (res.state === "valid" || res.state === "invalid") {
        sessionCache.set(email, res.state)
        return res.state
      }
      return "unavailable"
    } catch {
      return "unavailable"
    } finally {
      inFlight.delete(email)
    }
  })()

  inFlight.set(email, promise)
  return promise
}

/**
 * Hook-free existence check sharing the same session cache and in-flight
 * dedup, used by form submit gates that verify every proponent email in one
 * pass. Only meaningful for format-valid, domain-allowed addresses — callers
 * should gate those through the sync validators first.
 */
export async function checkEmailExistence(
  rawEmail: string
): Promise<EmailExistenceState> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) return "unavailable"
  return sessionCache.get(email) ?? fetchExistence(email)
}

/**
 * On-blur mailbox checker backed by GET /api/v1/public/validate-email.
 * Call check(email) from the field's onBlur and from submit handlers
 * (awaiting the returned state); reset() when the field value changes.
 */
export function useEmailExistence() {
  const [state, setState] = useState<EmailExistenceState>("idle")
  const lastRequested = useRef<string>("")

  const check = useCallback(async (rawEmail: string): Promise<EmailExistenceState> => {
    const email = rawEmail.trim().toLowerCase()

    // Only verify syntactically valid, domain-allowed addresses.
    if (!email || validateEmailLive(email) || validateEmailDomain(email)) {
      lastRequested.current = ""
      setState("idle")
      return "idle"
    }

    lastRequested.current = email

    if (sessionCache.has(email)) {
      const cachedState = sessionCache.get(email)!
      setState(cachedState)
      return cachedState
    }

    setState("checking")
    const result = await fetchExistence(email)

    // Ignore the response if the user moved on to a different address.
    if (lastRequested.current === email) {
      setState(result)
    }
    return result
  }, [])

  const reset = useCallback(() => {
    lastRequested.current = ""
    setState("idle")
  }, [])

  return { state, check, reset }
}
