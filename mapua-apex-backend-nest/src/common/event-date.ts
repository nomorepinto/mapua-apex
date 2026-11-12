import { addDays } from './availability-window.js';
import { abort } from './http.js';
import { manilaDate } from './manila.js';

export const DEFAULT_EVENT_DATE_MIN_LEAD_DAYS = 10;

export function eventDateTooSoonMessage(leadDays: number): string {
  return `The date of event must be at least ${leadDays} days from today.`;
}

/**
 * Minimum `YYYY-MM-DD` a proposal or reservation may use.
 * `undefined` when `VITE_ALLOW_ANY_EVENT_DATE` is on, matching the SPA picker.
 */
export function eventDateFloorKey(
  allowAny: boolean,
  today = manilaDate(),
  leadDays = DEFAULT_EVENT_DATE_MIN_LEAD_DAYS,
): string | undefined {
  if (allowAny) {
    return undefined;
  }
  return addDays(today, leadDays);
}

export function assertEventDateAllowed(
  date: string | undefined,
  floor: string | undefined,
  leadDays = DEFAULT_EVENT_DATE_MIN_LEAD_DAYS,
): void {
  if (!floor || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return;
  }
  if (date < floor) {
    abort(422, eventDateTooSoonMessage(leadDays));
  }
}
