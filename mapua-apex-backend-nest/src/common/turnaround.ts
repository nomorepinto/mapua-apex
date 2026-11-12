const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const OFFSET_MS = 8 * 60 * MINUTE_MS;
const OPEN_MINUTES = 8 * 60;
const CLOSE_MINUTES = 17 * 60;

/**
 * Desk durations count only Manila working hours: Monday to Friday,
 * 08:00-17:00 at a fixed UTC+8 offset (no DST, no holiday calendar).
 */
export const WORKING_HOURS_RULE =
  'Mon–Fri 08:00–17:00 Asia/Manila, holidays not excluded';

export function describeWorkingHours(): string {
  return WORKING_HOURS_RULE;
}

/** Wall-clock minutes between two timestamps, mirroring `duration()` in reporting.ts. */
export function wallMinutes(start: unknown, end: unknown): number | null {
  const value = Date.parse(String(end)) - Date.parse(String(start));
  return Number.isFinite(value) && value >= 0 ? value / MINUTE_MS : null;
}

/**
 * Minutes of overlap between `[start, end)` and the Manila working window.
 * Clamped to >= 0; null when either side is unparsable or end < start.
 */
export function workingMinutes(start: unknown, end: unknown): number | null {
  const from = Date.parse(String(start));
  const to = Date.parse(String(end));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return null;
  }
  const shiftedFrom = from + OFFSET_MS;
  const shiftedTo = to + OFFSET_MS;
  const firstDay = Math.floor(shiftedFrom / DAY_MS);
  const lastDay = Math.floor((shiftedTo - 1) / DAY_MS);
  let total = 0;
  for (let day = firstDay; day <= lastDay; day += 1) {
    // Unix day 0 was a Thursday; shift so 0 = Sunday like Date#getUTCDay.
    const weekday = (((day + 4) % 7) + 7) % 7;
    if (weekday === 0 || weekday === 6) {
      continue;
    }
    const open = day * DAY_MS + OPEN_MINUTES * MINUTE_MS;
    const close = day * DAY_MS + CLOSE_MINUTES * MINUTE_MS;
    total += Math.max(0, Math.min(shiftedTo, close) - Math.max(shiftedFrom, open));
  }
  return Math.max(0, Math.round(total / MINUTE_MS));
}
