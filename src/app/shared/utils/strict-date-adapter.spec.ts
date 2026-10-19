import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';

import { parseStrictDate, provideStrictDateAdapter, QBE_DATE_FORMATS, StrictDateAdapter } from './strict-date-adapter';

function ymd(date: Date | null): [number, number, number] | null {
  return date ? [date.getFullYear(), date.getMonth() + 1, date.getDate()] : null;
}

describe('parseStrictDate', () => {
  it.each([
    ['02/29/2001'],
    ['02/30/2026'],
    ['13/45/2026'],
    ['11/31/2026'],
    ['00/10/2026'],
    ['2026-02-30'],
    ['3/1/26'],
    ['tomorrow'],
    ['March 1, 2026'],
  ])('rejects %s instead of rolling it over', (text) => {
    const parsed = parseStrictDate(text);

    expect(parsed).not.toBeNull();
    expect(isNaN(parsed!.getTime())).toBe(true);
  });

  it.each([
    ['02/29/2024', [2024, 2, 29]],
    ['2/9/2026', [2026, 2, 9]],
    ['12-31-2026', [2026, 12, 31]],
    ['2026-10-19', [2026, 10, 19]],
    [' 10/19/2026 ', [2026, 10, 19]],
  ])('accepts %s as a local calendar day', (text, expected) => {
    expect(ymd(parseStrictDate(text))).toEqual(expected);
  });

  it('treats empty text as no value', () => {
    expect(parseStrictDate('')).toBeNull();
    expect(parseStrictDate('   ')).toBeNull();
  });
});

describe('StrictDateAdapter', () => {
  function adapter(): DateAdapter<Date> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideStrictDateAdapter()] });
    return TestBed.inject(DateAdapter);
  }

  it('is what provideStrictDateAdapter registers, with the MM/dd/yyyy formats', () => {
    expect(adapter()).toBeInstanceOf(StrictDateAdapter);
    expect(TestBed.inject(MAT_DATE_FORMATS)).toBe(QBE_DATE_FORMATS);
  });

  it('marks an impossible typed date invalid so the datepicker reports a parse error', () => {
    const a = adapter();
    const parsed = a.parse('02/30/2026', QBE_DATE_FORMATS.parse.dateInput);

    expect(a.isValid(parsed as Date)).toBe(false);
    expect(a.getValidDateOrNull(parsed)).toBeNull();
  });

  it('still parses timestamps and keeps null for empty input', () => {
    const a = adapter();

    expect(a.parse(Date.UTC(2026, 0, 2), null)?.getTime()).toBe(Date.UTC(2026, 0, 2));
    expect(a.parse('', null)).toBeNull();
  });

  it('formats with two-digit month and day', () => {
    const a = adapter();

    expect(a.format(new Date(2027, 2, 1), QBE_DATE_FORMATS.display.dateInput)).toBe('03/01/2027');
  });
});
