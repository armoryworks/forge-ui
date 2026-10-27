import { describe, expect, it } from 'vitest';

import { parseCsvDate, parseCsvNumber, parseCsvText, pickCsv } from './csv-import';

describe('csv-import utils', () => {
  it('parses a header row into lower-cased keys and drops blank rows', () => {
    const { records, errors } = parseCsvText('Job Number,Customer\nJ-1,Acme\n,\nJ-2,Globex\n');

    expect(errors).toEqual([]);
    expect(records).toEqual([{ 'job number': 'J-1', customer: 'Acme' }, { 'job number': 'J-2', customer: 'Globex' }]);
    expect(pickCsv(records[0], 'jobnumber', 'job number')).toBe('J-1');
    expect(pickCsv(records[0], 'missing')).toBeUndefined();
  });

  it('reads money-style numbers and flags unreadable ones', () => {
    expect(parseCsvNumber('$1,234.50')).toBe(1234.5);
    expect(parseCsvNumber('(12.00)')).toBe(-12);
    expect(parseCsvNumber('  ')).toBeNull();
    expect(parseCsvNumber('twelve')).toBeNaN();
  });

  it('reads ISO and US dates and refuses impossible ones', () => {
    expect(parseCsvDate('2026-03-11')).toBe('2026-03-11T00:00:00Z');
    expect(parseCsvDate('03/11/2026')).toBe('2026-03-11T00:00:00Z');
    expect(parseCsvDate('')).toBeNull();
    expect(parseCsvDate('02/30/2026')).toBeUndefined();
    expect(parseCsvDate('next tuesday')).toBeUndefined();
  });
});
