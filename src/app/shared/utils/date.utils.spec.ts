import { describe, it, expect } from 'vitest';

import { fromIsoDate, toIsoDate } from './date.utils';

describe('fromIsoDate', () => {
  it('keeps the calendar day of a UTC-midnight value', () => {
    const d = fromIsoDate('2026-10-30T00:00:00Z');

    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(9);
    expect(d!.getDate()).toBe(30);
    expect(d!.getHours()).toBe(0);
  });

  it('accepts a Date already parsed from the API', () => {
    const d = fromIsoDate(new Date(Date.UTC(2026, 0, 1)));

    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2026, 0, 1]);
  });

  it('round-trips through toIsoDate without slipping a day', () => {
    expect(toIsoDate(fromIsoDate('2026-10-30T00:00:00Z'))).toBe('2026-10-30T00:00:00Z');
    expect(toIsoDate(fromIsoDate(toIsoDate(new Date(2026, 2, 8))))).toBe('2026-03-08T00:00:00Z');
  });

  it('returns null for empty or invalid input', () => {
    expect(fromIsoDate(null)).toBeNull();
    expect(fromIsoDate(undefined)).toBeNull();
    expect(fromIsoDate('')).toBeNull();
    expect(fromIsoDate('not a date')).toBeNull();
  });
});
