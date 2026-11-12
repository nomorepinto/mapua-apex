import type { ApiSubmission, DeskTiming } from "@/lib/dynamodb-adapters"

/**
 * Display-only turnaround helpers. All clock math (wall/working minutes) is
 * computed server-side and stored on each `DeskTiming`; nothing here re-derives
 * durations, it only formats the stored minutes and picks entries by role.
 */

/**
 * Human duration from minutes: `45 m` under an hour, `6 h 20 m` under a day,
 * `2 d 4 h` beyond. Returns `null` when there is nothing to show so callers can
 * omit the fragment entirely rather than render `0 m`.
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return null
  }
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} m`
  const days = Math.floor(total / 1440)
  const hours = Math.floor((total % 1440) / 60)
  const mins = total % 60
  if (days > 0) return hours > 0 ? `${days} d ${hours} h` : `${days} d`
  return mins > 0 ? `${hours} h ${mins} m` : `${hours} h`
}

/** Total wall-clock turnaround from first submit to final approval, in minutes. */
export function overallTurnaroundMinutes(submission: ApiSubmission): number | null {
  const start = submission.first_submitted_at ?? submission.sent_at
  const end = submission.fully_approved_at
  if (!start || !end) return null
  const ms = Date.parse(end) - Date.parse(start)
  return Number.isFinite(ms) && ms >= 0 ? ms / 60000 : null
}

/**
 * Desk timings for a role, summed working minutes (multi-org chains run
 * sequentially, so summing is correct). Returns `null` when the paper has no
 * stored history or no entry for that role.
 */
export function roleWorkingMinutes(
  timings: DeskTiming[] | undefined,
  role: string
): number | null {
  if (!timings || timings.length === 0) return null
  let total = 0
  let sampled = false
  for (const entry of timings) {
    if (entry.role !== role) continue
    if (entry.working_minutes === null || entry.working_minutes === undefined) continue
    total += entry.working_minutes
    sampled = true
  }
  return sampled ? total : null
}

/**
 * Match a stored desk timing to a stepper stage: by `signatory_id` first, then
 * by `role` on the legacy no-chain path. Returns the entry's working minutes.
 */
export function stageWorkingMinutes(
  timings: DeskTiming[] | undefined,
  match: { signatoryId?: string | null; role?: string | null }
): number | null {
  if (!timings || timings.length === 0) return null
  const bySignatory = match.signatoryId
    ? timings.find((entry) => entry.signatory_id === match.signatoryId)
    : undefined
  const entry =
    bySignatory ??
    (match.role ? timings.find((item) => item.role === match.role) : undefined)
  if (!entry) return null
  return entry.working_minutes ?? entry.wall_minutes ?? null
}
