import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { formatDate, fromIsoDate, parseDateOnly, toDateOnly, toIsoDate } from './date.utils';

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

describe('date-only values west of UTC', () => {
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it.each(['2026-10-26', '2026-10-26T00:00:00Z', '2026-10-26T00:00:00+00:00', '2026-10-26T00:00:00.000Z'])(
    'parseDateOnly keeps the calendar day of %s',
    value => {
      const d = parseDateOnly(value);

      expect([d!.getFullYear(), d!.getMonth(), d!.getDate(), d!.getHours()]).toEqual([2026, 9, 26, 0]);
    },
  );

  it('parseDateOnly leaves real timestamps to normal parsing', () => {
    expect(parseDateOnly('2026-10-26T06:00:00.000Z')).toBeNull();
    expect(parseDateOnly('2026-10-26T00:00:00-06:00')).toBeNull();
    expect(parseDateOnly('not a date')).toBeNull();
  });

  it('toIsoDate does not slip a day for a value the API sent back', () => {
    expect(toIsoDate('2026-10-26T00:00:00+00:00')).toBe('2026-10-26T00:00:00Z');
    expect(toIsoDate('2026-10-26')).toBe('2026-10-26T00:00:00Z');
  });

  it('toIsoDate keeps a restored draft that holds a local-midnight timestamp', () => {
    const draft = JSON.parse(JSON.stringify(new Date(2026, 9, 26))) as string;

    expect(toIsoDate(draft)).toBe('2026-10-26T00:00:00Z');
  });

  it('toDateOnly and formatDate keep the calendar day of a UTC-midnight value', () => {
    expect(toDateOnly('2026-10-16T00:00:00+00:00')).toBe('2026-10-16');
    expect(formatDate('2026-10-16T00:00:00+00:00')).toBe('10/16/2026');
  });
});
