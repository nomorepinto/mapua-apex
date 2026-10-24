const OFFSET_MS = 8 * 60 * 60 * 1000;

/** Asia/Manila has no daylight saving. Windows are computed from that clock. */
export function manilaNow(now = new Date()): Date {
  return now;
}

export function startOfManilaDay(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  return new Date(`${date}T00:00:00+08:00`);
}

export function endOfManilaDay(date: string): Date | null {
  const start = startOfManilaDay(date);
  if (!start) {
    return null;
  }
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function addManilaDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface VisibilityWindow {
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
}

export function eventWindow(
  dateOfEvent: string | null,
  kind: 'attendance' | 'evaluation',
  windowDays: number,
  now = new Date(),
): VisibilityWindow {
  const opens = dateOfEvent ? startOfManilaDay(dateOfEvent) : null;
  const dayEnd = dateOfEvent ? endOfManilaDay(dateOfEvent) : null;
  const closes =
    dayEnd && kind === 'evaluation'
      ? addManilaDays(dayEnd, windowDays)
      : dayEnd;
  const isOpen = Boolean(opens && closes && now >= opens && now <= closes);
  return {
    opens_at: opens ? opens.toISOString() : null,
    closes_at: closes ? closes.toISOString() : null,
    is_open: isOpen,
  };
}

export function manilaDate(now = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}
