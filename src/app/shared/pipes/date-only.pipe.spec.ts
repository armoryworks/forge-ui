import { afterEach, beforeEach, describe, it, expect } from 'vitest';

import { DateOnlyPipe } from './date-only.pipe';

describe('DateOnlyPipe', () => {
  const pipe = new DateOnlyPipe();
  let originalTz: string | undefined;

  beforeEach(() => {
    originalTz = process.env['TZ'];
    process.env['TZ'] = 'America/Denver';
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  it('keeps the calendar day of a UTC-midnight value in a negative-offset timezone', () => {
    expect(new Date('2026-10-30T00:00:00Z').getDate()).toBe(29);

    expect(pipe.transform('2026-10-30T00:00:00Z')).toBe('10/30/2026');
    expect(pipe.transform('2026-01-01T00:00:00Z')).toBe('01/01/2026');
  });

  it('accepts a Date already parsed from the API', () => {
    expect(pipe.transform(new Date(Date.UTC(2026, 2, 8)))).toBe('03/08/2026');
  });

  it.each([null, undefined, '', 'not a date'])('returns an empty string for %s', value => {
    expect(pipe.transform(value)).toBe('');
  });
});
