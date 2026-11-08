import { Injectable } from '@nestjs/common';
import { nowIso } from '../common/dynamo-keys.js';
import { abort } from '../common/http.js';
import { record, str, type Item } from '../common/records.js';
import { UpdateTermSettingsDto } from './dto/term-settings.dto.js';
import { TERM_KEY, TermSettingsRepository } from './term-settings.repository.js';
import type { AcademicTerm, AcademicYear, TermBlackout, TermSettings } from './term-window.js';

@Injectable()
export class TermSettingsService {
  constructor(private readonly terms: TermSettingsRepository) {}

  async get(): Promise<TermSettings | undefined> {
    const item = await this.terms.get();
    return item ? this.view(item) : undefined;
  }

  async replace(input: UpdateTermSettingsDto, updatedBy: string): Promise<TermSettings> {
    const value = this.validate(input);
    await this.terms.put({ PK: TERM_KEY, SK: TERM_KEY, ...value, updated_at: nowIso(), updated_by: updatedBy });
    return value;
  }

  private validate(input: UpdateTermSettingsDto): TermSettings {
    const academic_years = input.academic_years.map((year) => {
      const id = year.id.trim(); const label = year.label.trim();
      if (!id || !label) abort(422, 'Each academic year requires an id and label.');
      const terms = year.terms.map((term) => this.validateTerm(term));
      this.assertNonOverlapping(terms, 'Academic terms must not overlap.');
      return { id, label, terms };
    });
    if (new Set(academic_years.map((year) => year.id)).size !== academic_years.length) abort(422, 'Each academic year must have a different id.');
    if (new Set(academic_years.map((year) => year.label.toLowerCase())).size !== academic_years.length) abort(422, 'Academic year labels must be different.');
    const active_academic_year_id = input.active_academic_year_id.trim();
    if (!academic_years.some((year) => year.id === active_academic_year_id)) abort(422, 'Select an active academic year.');
    return { active_academic_year_id, academic_years };
  }

  private validateTerm(input: UpdateTermSettingsDto['academic_years'][number]['terms'][number]): AcademicTerm {
    const id = input.id.trim(); const label = input.label.trim();
    const start = input.start.slice(0, 10); const end = input.end.slice(0, 10);
    if (!id || !label) abort(422, 'Each academic term requires an id and label.');
    if (end < start) abort(422, 'A term end must be on or after its start.');
    const blackouts = input.blackouts.map((entry) => ({ start: entry.start.slice(0, 10), end: entry.end.slice(0, 10), reason: entry.reason.trim() }));
    for (const blackout of blackouts) {
      if (!blackout.reason) abort(422, 'Each blackout requires a reason.');
      if (blackout.end < blackout.start) abort(422, 'A blackout end must be on or after its start.');
      if (blackout.start < start || blackout.end > end) abort(422, 'Blackouts must fall within their academic term.');
    }
    this.assertNonOverlapping(blackouts, 'Blackout date ranges must not overlap.');
    return { id, label, start, end, blackouts };
  }

  private assertNonOverlapping<T extends { start: string; end: string }>(rows: T[], message: string): void {
    const ordered = [...rows].sort((left, right) => left.start.localeCompare(right.start));
    if (ordered.some((row, index) => index > 0 && row.start <= ordered[index - 1].end)) abort(422, message);
  }

  private view(item: Item): TermSettings {
    if (Array.isArray(item.academic_years)) {
      const years = item.academic_years.flatMap((row) => this.year(row));
      return { active_academic_year_id: str(item, 'active_academic_year_id') ?? years[0]?.id ?? '', academic_years: years };
    }
    const terms = Array.isArray(item.terms) ? item.terms.flatMap((row) => this.term(row)) : this.legacyTerms(item);
    const id = 'ay-legacy';
    return { active_academic_year_id: id, academic_years: terms.length ? [{ id, label: str(item, 'academic_year') ?? 'Academic year', terms }] : [] };
  }

  private year(row: unknown): AcademicYear[] {
    const value = record(row); const id = value ? str(value, 'id') : null; const label = value ? str(value, 'label') : null;
    const terms = Array.isArray(value?.terms) ? value.terms.flatMap((term) => this.term(term)) : [];
    return id && label && terms.length ? [{ id, label, terms }] : [];
  }

  private term(row: unknown): AcademicTerm[] {
    const value = record(row); const id = value ? str(value, 'id') : null; const label = value ? str(value, 'label') : null;
    const start = value ? str(value, 'start') : null; const end = value ? str(value, 'end') : null;
    return id && label && start && end ? [{ id, label, start, end, blackouts: this.blackouts(value?.blackouts) }] : [];
  }

  private legacyTerms(item: Item): AcademicTerm[] {
    const start = str(item, 'term_start'); const end = str(item, 'term_end');
    return start && end ? [{ id: 'term-1', label: 'Term 1', start, end, blackouts: this.blackouts(item.blackouts) }] : [];
  }

  private blackouts(rows: unknown): TermBlackout[] {
    return Array.isArray(rows) ? rows.flatMap((row) => {
      const value = record(row); const start = value ? str(value, 'start') : null; const end = value ? str(value, 'end') : null; const reason = value ? str(value, 'reason') : null;
      return start && end && reason ? [{ start, end, reason }] : [];
    }) : [];
  }
}
