import { describe, expect, it } from 'vitest';
import {
  describeWorkingHours,
  wallMinutes,
  workingMinutes,
} from './turnaround.js';

// All instants below are written as Manila wall time (UTC+8).
describe('wallMinutes', () => {
  it('measures wall clock across days', () => {
    expect(
      wallMinutes('2026-11-09T08:00:00+08:00', '2026-11-11T20:00:00+08:00'),
    ).toBe(60 * 60);
  });

  it('returns null on a reversed pair', () => {
    expect(
      wallMinutes('2026-11-11T08:00:00+08:00', '2026-11-09T08:00:00+08:00'),
    ).toBeNull();
  });

  it('returns null on invalid input', () => {
    expect(wallMinutes('not-a-date', '2026-11-09T08:00:00+08:00')).toBeNull();
    expect(wallMinutes(undefined, null)).toBeNull();
  });
});

describe('workingMinutes', () => {
  it('counts a same-day span inside working hours', () => {
    // Wednesday 2026-11-11, 09:00 -> 12:30 Manila.
    expect(
      workingMinutes(
        '2026-11-11T09:00:00+08:00',
        '2026-11-11T12:30:00+08:00',
      ),
    ).toBe(210);
  });

  it('clamps to the working window on a single day', () => {
    // Wednesday 07:00 -> 19:00 Manila: only 08:00-17:00 counts.
    expect(
      workingMinutes(
        '2026-11-11T07:00:00+08:00',
        '2026-11-11T19:00:00+08:00',
      ),
    ).toBe(9 * 60);
  });

  it('counts an overnight weekday span once per open day', () => {
    // Wednesday 16:00 -> Thursday 09:30: 60 + 90 minutes.
    expect(
      workingMinutes(
        '2026-11-11T16:00:00+08:00',
        '2026-11-12T09:30:00+08:00',
      ),
    ).toBe(150);
  });

  it('skips the weekend but keeps the surrounding weekdays', () => {
    // Friday 16:00 -> Monday 10:00: 60 Friday + 120 Monday.
    expect(
      workingMinutes(
        '2026-11-13T16:00:00+08:00',
        '2026-11-16T10:00:00+08:00',
      ),
    ).toBe(180);
  });

  it('returns 0 for a span fully inside the weekend', () => {
    // Saturday 09:00 -> Sunday 18:00 Manila.
    expect(
      workingMinutes(
        '2026-11-14T09:00:00+08:00',
        '2026-11-15T18:00:00+08:00',
      ),
    ).toBe(0);
  });

  it('returns 0 outside working hours on weekdays', () => {
    // Monday 17:30 -> Tuesday 07:30 Manila.
    expect(
      workingMinutes(
        '2026-11-09T17:30:00+08:00',
        '2026-11-10T07:30:00+08:00',
      ),
    ).toBe(0);
  });

  it('combines a weekend and overnight span', () => {
    // Friday 17:30 -> Monday 08:30: only Monday 08:00-08:30 counts.
    expect(
      workingMinutes(
        '2026-11-13T17:30:00+08:00',
        '2026-11-16T08:30:00+08:00',
      ),
    ).toBe(30);
  });

  it('returns null on a reversed pair', () => {
    expect(
      workingMinutes(
        '2026-11-12T09:00:00+08:00',
        '2026-11-11T09:00:00+08:00',
      ),
    ).toBeNull();
  });

  it('returns null on invalid input', () => {
    expect(workingMinutes('', '2026-11-11T09:00:00+08:00')).toBeNull();
    expect(workingMinutes('2026-11-11T09:00:00+08:00', 'nope')).toBeNull();
  });

  it('accepts UTC instants and converts them to the Manila clock', () => {
    // 2026-11-11T01:00:00Z = 09:00 Manila; 05:00Z = 13:00 Manila.
    expect(workingMinutes('2026-11-11T01:00:00Z', '2026-11-11T05:00:00Z')).toBe(
      240,
    );
  });
});

describe('describeWorkingHours', () => {
  it('states the rule used in report warnings', () => {
    expect(describeWorkingHours()).toBe(
      'Mon–Fri 08:00–17:00 Asia/Manila, holidays not excluded',
    );
  });
});
