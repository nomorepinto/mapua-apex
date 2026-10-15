import { useSyncExternalStore } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import type { GibberishState } from "@/hooks/use-gibberish-check"
import { peekGibberish, subscribeGibberishCache } from "@/hooks/use-gibberish-check"

/**
 * Per-field gibberish status line, styled to match the mailbox-existence lines in
 * SignInModal. Renders nothing for idle/clean/unavailable so a detector outage
 * never shows an error (fail open) and a disabled feature stays fully inert.
 */
export function GibberishIndicator({ state }: { state: GibberishState }) {
  if (state === "checking") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>Checking text...</span>
      </p>
    )
  }

  if (state === "gibberish") {
    return (
      <p className="mt-1 flex items-start gap-1 text-[11px] text-red-600 animate-in fade-in">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>This text looks like gibberish. Please revise it.</span>
      </p>
    )
  }

  return null
}

/**
 * Loop-safe variant of the indicator: it reads the verdict already held in the
 * session cache instead of owning per-field check state, so one can be rendered per row
 * inside a `.map()` — where calling a hook on each row is not allowed. It stays silent
 * until that exact text has actually been checked, either on blur or by the step's
 * Continue pass, and re-reads through the cache subscription when a verdict lands.
 */
export function GibberishValueHint({ value }: { value: string }) {
  const state = useSyncExternalStore(
    subscribeGibberishCache,
    () => peekGibberish(value) ?? "idle"
  )
  return <GibberishIndicator state={state} />
}
