import { describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import {
  assertEventDateAllowed,
  eventDateFloorKey,
  EVENT_DATE_TOO_SOON_MESSAGE,
} from './event-date.js';

describe('eventDateFloorKey', () => {
  it('requires 10 days from the Manila calendar day', () => {
    expect(eventDateFloorKey(false, '2026-10-30')).toBe('2026-11-09');
  });

  it('lifts the floor when the event-date override is on', () => {
    expect(eventDateFloorKey(true, '2026-10-30')).toBeUndefined();
  });
});

describe('assertEventDateAllowed', () => {
  it('rejects a start or reservation date before the floor', () => {
    expect(() => assertEventDateAllowed('2026-11-08', '2026-11-09')).toThrow(
      HttpException,
    );
    try {
      assertEventDateAllowed('2026-11-08', '2026-11-09');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(422);
      expect((error as HttpException).getResponse()).toEqual({
        message: EVENT_DATE_TOO_SOON_MESSAGE,
      });
    }
  });

  it('accepts the floor day and any date when the override removes the floor', () => {
    expect(() =>
      assertEventDateAllowed('2026-11-09', '2026-11-09'),
    ).not.toThrow();
    expect(() =>
      assertEventDateAllowed('2020-01-01', undefined),
    ).not.toThrow();
  });
});
