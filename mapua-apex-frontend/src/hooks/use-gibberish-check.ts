import { createElement, useCallback, useRef, useState } from "react"

import { GibberishIndicator } from "@/components/ui/gibberish-indicator"
import { apiClient } from "@/lib/api-client"

/**
 * Gibberish-check state surfaced to a single text field.
 * "unavailable" means the detector (or its backend proxy) could not answer; forms
 * treat that as non-blocking (fail open) so an outage never locks users out. The
 * whole feature is inert when VITE_GIBBERISH_CHECK_ENABLED is not "true".
 */
export type GibberishState = "idle" | "checking" | "clean" | "gibberish" | "unavailable"

interface DetectGibberishResponse {
  is_gibberish: boolean
  cached?: boolean
}

// Feature flag mirrors the backend GIBBERISH_CHECK_ENABLED gate. Vite inlines this
// at build time from the monorepo-root .env, so off = zero detector calls.
const ENABLED = import.meta.env.VITE_GIBBERISH_CHECK_ENABLED === "true"

// Skip trivially short tokens: single words are unreliable for the detector and
// waste an API call, so only meaningfully typed text is checked.
const MIN_GIBBERISH_LENGTH = 8

// Session-scoped cache + in-flight dedup so each distinct string costs at most one
// proxied lookup per page session (shared by the on-blur hook and submit passes).
const sessionCache = new Map<string, GibberishState>()
const inFlight = new Map<string, Promise<GibberishState>>()

// Verdicts live outside React, so cache writes are broadcast to let the
// loop-rendered hint (GibberishValueHint) re-read its own value the moment a
// step-wide check finishes — without a hook per row, which a `.map()` forbids.
const cacheListeners = new Set<() => void>()

function notifyCacheChange() {
  for (const listener of cacheListeners) listener()
}

/** Subscribe to verdict-cache writes. Returns the unsubscribe function. */
export function subscribeGibberishCache(listener: () => void): () => void {
  cacheListeners.add(listener)
  return () => {
    cacheListeners.delete(listener)
  }
}

async function fetchGibberish(text: string): Promise<GibberishState> {
  const cachedResult = sessionCache.get(text)
  if (cachedResult) return cachedResult

  const existing = inFlight.get(text)
  if (existing) return existing

  const promise = (async (): Promise<GibberishState> => {
    try {
      const res = await apiClient.post<DetectGibberishResponse>("public/detect-gibberish", {
        text,
      })
      const state: GibberishState = res.is_gibberish ? "gibberish" : "clean"
      sessionCache.set(text, state)
      notifyCacheChange()
      return state
    } catch {
      // Outage / proxy disabled: fail open as "clean" so nothing is blocked, but
      // leave it uncached so a later attempt can re-check once the service returns.
      return "unavailable"
    } finally {
      inFlight.delete(text)
    }
  })()

  inFlight.set(text, promise)
  return promise
}

/**
 * Hook-free check sharing the same session cache and in-flight dedup, used by form
 * submit gates that verify every in-scope text field in one pass. Returns "clean"
 * instantly when the feature is disabled or the text is trivially short.
 */
export async function checkGibberish(rawText: string): Promise<GibberishState> {
  if (!ENABLED) return "clean"
  const text = (rawText || "").trim()
  if (!text || text.length < MIN_GIBBERISH_LENGTH) return "clean"
  return sessionCache.get(text) ?? fetchGibberish(text)
}

/**
 * One named piece of free text belonging to a form step. Forms are built from
 * `.map()` loops (one card per room, per proponent, per budget line), where a
 * per-field hook cannot be called — so a step gates its whole group at once and
 * names the offenders through the step's existing issue list instead.
 */
export interface GibberishField {
  label: string
  value: string
}

/**
 * Sync read of a verdict already fetched this session; `undefined` means unknown.
 * Lets a render-time issue list name flagged fields without firing a network call.
 */
export function peekGibberish(rawText: string): GibberishState | undefined {
  if (!ENABLED) return undefined
  const text = (rawText || "").trim()
  if (!text || text.length < MIN_GIBBERISH_LENGTH) return undefined
  return sessionCache.get(text)
}

/**
 * Checks a whole group of fields in one pass (cache + in-flight shared, so fields
 * already checked on blur cost nothing) and returns the labels that came back as
 * gibberish. Empty when the feature is disabled — a step is never blocked by it.
 */
export async function checkGibberishFields(
  fields: GibberishField[]
): Promise<string[]> {
  if (!ENABLED || fields.length === 0) return []
  const states = await Promise.all(fields.map((field) => checkGibberish(field.value)))
  return fields.filter((_, index) => states[index] === "gibberish").map((f) => f.label)
}

/**
 * Whether this exact text has already come back as gibberish. Plain function, so a
 * loop-rendered field can use it to glow its own border without a hook.
 */
export function isFlaggedGibberish(rawText: string): boolean {
  return peekGibberish(rawText) === "gibberish"
}

/**
 * Same question as `checkGibberishFields`, answered only from verdicts already
 * known — used to keep an issue list honest between checks without new calls.
 */
export function findKnownGibberishLabels(fields: GibberishField[]): string[] {
  return fields
    .filter((field) => peekGibberish(field.value) === "gibberish")
    .map((field) => field.label)
}

/** Issue-list line for each field of a group already known to be gibberish. */
export function gibberishIssueLines(fields: GibberishField[]): string[] {
  return findKnownGibberishLabels(fields).map(
    (label) => `${label}: This text looks like gibberish. Please revise it.`
  )
}

/**
 * On-blur gibberish checker backed by POST /api/v1/public/detect-gibberish.
 * Call check(value) from the field's onBlur and reset() when the value changes;
 * render <GibberishIndicator state={state} /> beneath the field.
 */
export function useGibberishCheck() {
  const [state, setState] = useState<GibberishState>("idle")
  const lastRequested = useRef<string>("")

  const check = useCallback(async (rawText: string): Promise<GibberishState> => {
    const text = (rawText || "").trim()

    // Disabled or trivially short text: nothing to check, no indicator shown.
    if (!ENABLED || !text || text.length < MIN_GIBBERISH_LENGTH) {
      lastRequested.current = ""
      setState("idle")
      return "idle"
    }

    lastRequested.current = text

    if (sessionCache.has(text)) {
      const cachedState = sessionCache.get(text)!
      setState(cachedState)
      return cachedState
    }

    setState("checking")
    const result = await fetchGibberish(text)

    // Ignore the response if the user moved on to different text.
    if (lastRequested.current === text) {
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

/**
 * Convenience wrapper for wiring one field: pass the field's current value and get
 * back the onBlur handler, a reset for onChange, the live state (for submit gates),
 * and an `indicator` element to render beneath the input.
 */
export function useGibberishField(value: string) {
  const { state, check, reset } = useGibberishCheck()

  return {
    state,
    check,
    onBlur: () => check(value),
    reset,
    indicator: createElement(GibberishIndicator, { state }),
  }
}
