export const SLOT_COUNT = 12;
export const SLOT_MINUTES = 70;
export const DAY_START_MINUTES = 7 * 60;
export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type Weekday = (typeof DAYS)[number];
export type Schedule = Record<Weekday, boolean[]>;

export interface Selection {
  date: string;
  slots: number[];
}

const SLOT_LABELS = [
  '07:00-08:10',
  '08:10-09:20',
  '09:20-10:30',
  '10:30-11:40',
  '11:40-12:50',
  '12:50-14:00',
  '14:00-15:10',
  '15:10-16:20',
  '16:20-17:30',
  '17:30-18:40',
  '18:40-19:50',
  '19:50-21:00',
];

export function slotLabel(slot: number): string {
  return SLOT_LABELS[slot] ?? `${slot}`;
}

export function slotStart(slot: number): string {
  const minutes = DAY_START_MINUTES + slot * SLOT_MINUTES;
  return formatMinutes(minutes);
}

export function slotEnd(slot: number): string {
  return formatMinutes(DAY_START_MINUTES + (slot + 1) * SLOT_MINUTES);
}

export function isValidSlot(slot: unknown): slot is number {
  return (
    typeof slot === 'number' &&
    Number.isInteger(slot) &&
    slot >= 0 &&
    slot < SLOT_COUNT
  );
}

export function normalizeSchedule(input: unknown): Schedule {
  const source =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const schedule = {} as Schedule;
  for (const day of DAYS) {
    const slots = Array.isArray(source[day]) ? source[day] : [];
    schedule[day] = Array.from({ length: SLOT_COUNT }, (_, index) =>
      Boolean(slots[index]),
    );
  }
  return schedule;
}

export function dayKeyForDate(date: string): Weekday | null {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const names = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const name = names[parsed.getUTCDay()];
  return (DAYS as readonly string[]).includes(name ?? '')
    ? (name as Weekday)
    : null;
}

export function templateAllows(
  schedule: Schedule,
  date: string,
  slot: number,
): boolean {
  const day = dayKeyForDate(date);
  if (!day || !isValidSlot(slot)) {
    return false;
  }
  return schedule[day][slot] === true;
}

export function normalizeSelections(input: unknown): Selection[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const byDate = new Map<string, Set<number>>();
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const date = (entry as { date?: unknown }).date;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    const slots = (entry as { slots?: unknown }).slots;
    const set = byDate.get(date) ?? new Set<number>();
    if (Array.isArray(slots)) {
      for (const slot of slots) {
        const value =
          typeof slot === 'string' && /^\d+$/.test(slot) ? Number(slot) : slot;
        if (isValidSlot(value)) {
          set.add(value);
        }
      }
    }
    if (set.size > 0) {
      byDate.set(date, set);
    }
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, slots]) => ({
      date,
      slots: [...slots].sort((a, b) => a - b),
    }));
}

export function capacityLabel(
  min: number | null,
  max: number | null,
): string | null {
  if (min !== null && max !== null) {
    return `between ${min} and ${max} participants`;
  }
  if (max !== null) {
    return `up to ${max} participants`;
  }
  if (min !== null) {
    return `at least ${min} participants`;
  }
  return null;
}

export function withinCapacity(
  type: string,
  expected: number | null,
  min: number | null,
  max: number | null,
): boolean {
  if (expected === null || type !== 'room') {
    return true;
  }
  if (min !== null && expected < min) {
    return false;
  }
  if (max !== null && expected > max) {
    return false;
  }
  return true;
}

export function weekdayName(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
