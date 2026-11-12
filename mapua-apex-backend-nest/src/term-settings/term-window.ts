import { addDays } from '../common/availability-window.js';
import { abort } from '../common/http.js';

export interface TermBlackout {
  start: string;
  end: string;
  reason: string;
}

export interface TermSettings {
  active_academic_year_id: string;
  academic_years: AcademicYear[];
  event_filing_lead_days: number;
}

export interface AcademicYear {
  id: string;
  label: string;
  terms: AcademicTerm[];
}

export interface AcademicTerm {
  id: string;
  label: string;
  start: string;
  end: string;
  blackouts: TermBlackout[];
}

/** Pure calendar-date policy shared by proposal and reservation date writes. */
export function assertTermDateAllowed(
  date: string | undefined,
  term: TermSettings | undefined,
  lockoutDays: number,
): void {
  if (!date || !term) {
    return;
  }
  const year = term.academic_years.find(
    (entry) => entry.id === term.active_academic_year_id,
  );
  if (!year) abort(422, 'No active academic year is configured.');
  const active = year.terms.find(
    (entry) => date >= entry.start && date <= entry.end,
  );
  if (!active) {
    abort(
      422,
      'The selected date is outside the configured academic calendar.',
    );
  }
  const blackout = active.blackouts.find(
    (range) => date >= range.start && date <= range.end,
  );
  if (blackout) {
    abort(
      422,
      `Events cannot be scheduled during blackout: ${blackout.reason}.`,
    );
  }
  if (lockoutDays > 0 && date >= addDays(active.end, 1 - lockoutDays)) {
    abort(
      422,
      'Events cannot be scheduled during the term-end lockout period.',
    );
  }
}
