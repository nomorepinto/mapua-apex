import type { ReservableDay, ReservableSchedule, SlotSelection } from "@/lib/types"

/**
 * Canonical reservable slot math — the single source of truth shared by the
 * SAAF reservation step, the CDM schedule grid, and the availability views.
 *
 * Mirrors backend `app/Aws/DynamoDb/ReservableSchedule.php` exactly so slot
 * indices and clock times never drift between the two systems:
 *  - Window 07:00-21:00, 70-minute slots => exactly 12 slots (slot 11 = 19:50-21:00).
 *  - Days monday..saturday (6 columns); Sunday is never reservable.
 *  - `schedule[day]` = 12 booleans (true = available); absent day => all unavailable.
 */

export const SLOT_COUNT = 12
export const INTERVAL_MINUTES = 70
/** 07:00, expressed as minutes from midnight. */
export const WINDOW_START_MINUTES = 7 * 60

/** Reservable weekday keys in display order. */
export const DAYS: readonly ReservableDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const

/** Short column labels for the schedule grid, aligned to `DAYS`. */
export const DAY_LABELS: Record<ReservableDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
}

/** `Date.getUTCDay()` (0=Sun..6=Sat) mapped to a reservable day key, or null for Sunday. */
const DAY_KEY_BY_UTCDAY: Record<number, ReservableDay | null> = {
  0: null, // Sunday — never reservable
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
}

export function isValidSlot(slot: unknown): slot is number {
  return typeof slot === "number" && Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT
}

/** Absolute minutes from midnight for a slot's start. */
export function slotStartMinutes(slot: number): number {
  return WINDOW_START_MINUTES + slot * INTERVAL_MINUTES
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

/** Slot start as `HH:MM` (24h). */
export function slotStart(slot: number): string {
  return formatMinutes(slotStartMinutes(slot))
}

/** Slot end as `HH:MM` (24h). */
export function slotEnd(slot: number): string {
  return formatMinutes(slotStartMinutes(slot) + INTERVAL_MINUTES)
}

/** Human label for a slot, e.g. `07:00-08:10`. */
export function slotLabel(slot: number): string {
  return `${slotStart(slot)}-${slotEnd(slot)}`
}

/** All 12 slot labels, index-aligned to slot numbers. */
export function slotLabels(): string[] {
  return Array.from({ length: SLOT_COUNT }, (_, slot) => slotLabel(slot))
}

/**
 * Map a concrete `YYYY-MM-DD` date to its weekday key, or null when it is not
 * reservable (Sunday, or an unparseable date). Parsed as UTC so the weekday is
 * stable regardless of the viewer's timezone.
 */
export function dayKeyForDate(date: string): ReservableDay | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return DAY_KEY_BY_UTCDAY[parsed.getUTCDay()] ?? null
}

/** A schedule with every day present and padded/truncated to exactly 12 booleans. */
export function normalizeSchedule(schedule?: Partial<ReservableSchedule> | null): ReservableSchedule {
  const normalized = {} as ReservableSchedule
  for (const day of DAYS) {
    const slots = Array.isArray(schedule?.[day]) ? (schedule?.[day] as boolean[]) : []
    const row: boolean[] = []
    for (let i = 0; i < SLOT_COUNT; i++) {
      row.push(Boolean(slots[i]))
    }
    normalized[day] = row
  }
  return normalized
}

/** An all-available Mon-Sat schedule (the CSV-import default, edited afterwards on the grid). */
export function allAvailableSchedule(): ReservableSchedule {
  const schedule = {} as ReservableSchedule
  for (const day of DAYS) {
    schedule[day] = Array.from({ length: SLOT_COUNT }, () => true)
  }
  return schedule
}

/** An all-unavailable schedule (blank starting point for the grid editor). */
export function emptySchedule(): ReservableSchedule {
  const schedule = {} as ReservableSchedule
  for (const day of DAYS) {
    schedule[day] = Array.from({ length: SLOT_COUNT }, () => false)
  }
  return schedule
}

/** Whether the weekly template marks a given date's slot as available. */
export function templateAllows(
  schedule: ReservableSchedule | undefined | null,
  date: string,
  slot: number
): boolean {
  if (!isValidSlot(slot)) return false
  const day = dayKeyForDate(date)
  if (!day) return false
  const row = schedule?.[day]
  if (!Array.isArray(row)) return false
  return Boolean(row[slot])
}

/**
 * Whether two slot-index sets overlap (share at least one slot). Used for
 * client-side pre-checks; the backend remains the authority on conflicts.
 */
export function slotsOverlap(a: number[], b: number[]): boolean {
  const set = new Set(a)
  return b.some((slot) => set.has(slot))
}

/**
 * Merge a new date+slots selection into an existing selection list, combining
 * slots when the date already exists and dropping dates left with no slots.
 * Returns a new array sorted by date with de-duplicated, sorted slots.
 */
export function withSelection(
  selections: SlotSelection[],
  date: string,
  slots: number[]
): SlotSelection[] {
  const validSlots = Array.from(new Set(slots.filter(isValidSlot))).sort((a, b) => a - b)
  const byDate = new Map<string, Set<number>>()
  for (const selection of selections) {
    byDate.set(selection.date, new Set(selection.slots.filter(isValidSlot)))
  }
  if (validSlots.length === 0) {
    byDate.delete(date)
  } else {
    byDate.set(date, new Set(validSlots))
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, set]) => ({ date: key, slots: Array.from(set).sort((a, b) => a - b) }))
}

/** Toggle a single slot on a date within a selection list. */
export function toggleSlot(
  selections: SlotSelection[],
  date: string,
  slot: number
): SlotSelection[] {
  if (!isValidSlot(slot)) return selections
  const current = selections.find((selection) => selection.date === date)
  const slots = current ? current.slots.filter(isValidSlot) : []
  const next = slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot]
  return withSelection(selections, date, next)
}

/** Total selected slots across every date in a selection list. */
export function countSelectedSlots(selections: SlotSelection[]): number {
  return selections.reduce((sum, selection) => sum + new Set(selection.slots).size, 0)
}

/**
 * Derive the earliest start and latest end across a selection list, formatted
 * as `HH:MM-HH:MM`. Returns null when nothing is selected. Used to set the
 * event's `time_of_event` from the reserved slots.
 */
export function selectionTimeRange(selections: SlotSelection[]): { start: string; end: string } | null {
  let minSlot: number | null = null
  let maxSlot: number | null = null
  for (const selection of selections) {
    for (const slot of selection.slots) {
      if (!isValidSlot(slot)) continue
      if (minSlot === null || slot < minSlot) minSlot = slot
      if (maxSlot === null || slot > maxSlot) maxSlot = slot
    }
  }
  if (minSlot === null || maxSlot === null) return null
  return { start: slotStart(minSlot), end: slotEnd(maxSlot) }
}

/**
 * Derive the min and max concrete dates across a selection list as
 * `YYYY-MM-DD`. Returns null when nothing is selected.
 */
export function selectionDateRange(selections: SlotSelection[]): { start: string; end: string } | null {
  const dates = selections.map((selection) => selection.date).filter(Boolean).sort()
  if (dates.length === 0) return null
  return { start: dates[0], end: dates[dates.length - 1] }
}

/* -------------------------------------------------------------------------- */
/* Weekly template editing helpers (Add / Edit reservable grid)                */
/* -------------------------------------------------------------------------- */

/** Flip a single day/slot cell in a weekly template, returning a new schedule. */
export function toggleScheduleSlot(
  schedule: ReservableSchedule,
  day: ReservableDay,
  slot: number
): ReservableSchedule {
  if (!isValidSlot(slot)) return schedule
  const row = Array.isArray(schedule[day]) ? [...schedule[day]] : Array.from({ length: SLOT_COUNT }, () => false)
  row[slot] = !row[slot]
  return { ...schedule, [day]: row }
}

/** Set an entire day column to available/unavailable. */
export function setScheduleDay(
  schedule: ReservableSchedule,
  day: ReservableDay,
  value: boolean
): ReservableSchedule {
  return { ...schedule, [day]: Array.from({ length: SLOT_COUNT }, () => value) }
}

/**
 * Flip a whole day column: if every slot is already available, clear the day;
 * otherwise make the whole day available.
 */
export function toggleScheduleDay(
  schedule: ReservableSchedule,
  day: ReservableDay
): ReservableSchedule {
  const row = schedule[day] ?? []
  const allOn = row.length === SLOT_COUNT && row.every(Boolean)
  return setScheduleDay(schedule, day, !allOn)
}

/** Count the available (true) cells across a whole weekly template. */
export function countAvailableSlots(schedule: ReservableSchedule | undefined | null): number {
  let total = 0
  for (const day of DAYS) {
    const row = schedule?.[day]
    if (Array.isArray(row)) {
      total += row.filter(Boolean).length
    }
  }
  return total
}
