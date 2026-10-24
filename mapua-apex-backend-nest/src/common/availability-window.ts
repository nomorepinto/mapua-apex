import { abort } from './http.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_SPAN_DAYS = 60;

export interface DateWindow {
  start: string;
  end: string;
}

export function resolveWindow(
  startRaw: unknown,
  endRaw: unknown,
  today = utcToday(),
): DateWindow {
  const start =
    typeof startRaw === 'string' && DATE.test(startRaw) ? startRaw : null;
  const end = typeof endRaw === 'string' && DATE.test(endRaw) ? endRaw : null;
  if (startRaw !== undefined && startRaw !== null && start === null) {
    abort(422, 'The start date must be a valid date (YYYY-MM-DD).');
  }
  if (endRaw !== undefined && endRaw !== null && end === null) {
    abort(422, 'The end date must be a valid date (YYYY-MM-DD).');
  }
  const resolvedStart = start ?? today;
  const resolvedEnd = end ?? addDays(resolvedStart, DEFAULT_SPAN_DAYS);
  if (resolvedEnd < resolvedStart) {
    abort(422, 'The end date must be on or after the start date.');
  }
  return { start: resolvedStart, end: resolvedEnd };
}

export function dateRange(start: string, end: string): string[] {
  if (end < start) {
    return [];
  }
  const dates: string[] = [];
  const limit = addDays(start, 366);
  let cursor = start;
  const last = end < limit ? end : limit;
  while (cursor <= last && dates.length < 400) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
