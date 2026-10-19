import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { DateTimePipe } from './date-time.pipe';

describe('DateTimePipe', () => {
  const pipe = new DateTimePipe();
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it('shows an afternoon timestamp in local time with PM', () => {
    expect(pipe.transform('2026-10-19T21:05:09Z')).toBe('10/19/2026 03:05 PM');
  });

  it('shows a morning timestamp with AM so it cannot be read as the afternoon', () => {
    expect(pipe.transform('2026-10-19T15:05:09Z')).toBe('10/19/2026 09:05 AM');
  });

  it('shows midnight and noon as 12 with the right meridiem', () => {
    expect(pipe.transform('2026-10-19T06:00:00Z')).toBe('10/19/2026 12:00 AM');
    expect(pipe.transform('2026-10-19T18:00:00Z')).toBe('10/19/2026 12:00 PM');
  });

  it('drops the year in the compact style and keeps AM/PM', () => {
    expect(pipe.transform('2026-10-19T21:05:09Z', 'compact')).toBe('10/19 03:05 PM');
  });

  it('shows only the time in the time styles', () => {
    expect(pipe.transform('2026-10-19T21:05:09Z', 'time')).toBe('03:05 PM');
    expect(pipe.transform('2026-10-19T21:05:09Z', 'timeSeconds')).toBe('03:05:09 PM');
  });

  it('shows a TimeOnly value from the API on the 12-hour clock', () => {
    expect(pipe.transform('17:30:00', 'time')).toBe('05:30 PM');
    expect(pipe.transform('06:00', 'time')).toBe('06:00 AM');
    expect(pipe.transform('23:59:59', 'timeSeconds')).toBe('11:59:59 PM');
  });

  it('accepts a Date already parsed from the API', () => {
    expect(pipe.transform(new Date(Date.UTC(2026, 9, 19, 21, 5)))).toBe('10/19/2026 03:05 PM');
  });

  it('accepts epoch milliseconds', () => {
    expect(pipe.transform(Date.UTC(2026, 9, 19, 21, 5))).toBe('10/19/2026 03:05 PM');
  });

  it.each([null, undefined, '', 'not a date'])('returns an empty string for %s', value => {
    expect(pipe.transform(value)).toBe('');
  });
});
