import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs helper shared with the backfill script
import { planBackfill } from '../../scripts/backfill-campus-departments.lib.mjs';
import { CAMPUS_ACADEMIC_CATALOG } from './campus-academic-catalog.js';

type Row = {
  PK: string;
  SK: string;
  name?: string;
  departments?: unknown[];
};

describe('campus departments backfill plan (C-1)', () => {
  const catalog = [
    {
      campus: 'Intramuros Campus',
      departments: [{ code: 'EECE', name: 'EECE', courses: [] }],
    },
    {
      campus: 'Makati Campus',
      departments: [{ code: 'SOIT', name: 'SOIT', courses: [] }],
    },
  ];

  it('matches campuses by name, case-insensitive and trimmed', () => {
    const rows: Row[] = [
      { PK: 'CAMPUS#a', SK: 'CAMPUS#a', name: '  intramuros campus ' },
      { PK: 'CAMPUS#b', SK: 'CAMPUS#b', name: 'MAKATI CAMPUS' },
    ];

    const plan = planBackfill(rows, catalog);

    expect(plan.updates.map((update: Row) => update.PK)).toEqual([
      'CAMPUS#a',
      'CAMPUS#b',
    ]);
    expect(plan.updates[0].departments).toEqual(catalog[0].departments);
    expect(plan.skipped).toEqual([]);
    expect(plan.unmatched).toEqual([]);
  });

  it('is idempotent: campuses with departments are skipped', () => {
    const rows: Row[] = [
      {
        PK: 'CAMPUS#a',
        SK: 'CAMPUS#a',
        name: 'Intramuros Campus',
        departments: [{ code: 'EECE', name: 'EECE', courses: [] }],
      },
      { PK: 'CAMPUS#b', SK: 'CAMPUS#b', name: 'Makati Campus' },
    ];

    const plan = planBackfill(rows, catalog);

    expect(plan.updates.map((update: Row) => update.PK)).toEqual(['CAMPUS#b']);
    expect(plan.skipped).toEqual(['Intramuros Campus']);
  });

  it('reports campuses with no catalog match without touching them', () => {
    const rows: Row[] = [
      { PK: 'CAMPUS#c', SK: 'CAMPUS#c', name: 'Seda Hotel, Manila Bay' },
    ];

    const plan = planBackfill(rows, catalog);

    expect(plan.updates).toEqual([]);
    expect(plan.unmatched).toEqual(['Seda Hotel, Manila Bay']);
  });

  it('covers the three real campuses with departments and courses', () => {
    const names = CAMPUS_ACADEMIC_CATALOG.map((entry) => entry.campus);
    expect(names).toEqual([
      'Intramuros Campus',
      'Makati Campus',
      'Seda Hotel, Manila Bay',
    ]);
    for (const entry of CAMPUS_ACADEMIC_CATALOG) {
      expect(entry.departments.length).toBeGreaterThan(0);
      for (const department of entry.departments) {
        expect(department.code).toBeTruthy();
        expect(department.name).toBeTruthy();
        expect(department.courses.length).toBeGreaterThan(0);
        for (const course of department.courses) {
          expect(course.code).toBeTruthy();
          expect(course.name).toBeTruthy();
        }
      }
    }
  });
});