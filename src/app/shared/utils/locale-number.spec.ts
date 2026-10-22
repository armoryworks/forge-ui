import { describe, it, expect } from 'vitest';

import { decimalPlaces, formatLocaleNumber, parseLocaleNumber } from './locale-number';

describe('parseLocaleNumber', () => {
  it('returns null for blank text', () => {
    expect(parseLocaleNumber('', 'en')).toBeNull();
    expect(parseLocaleNumber('   ', 'es')).toBeNull();
    expect(parseLocaleNumber(null, 'en')).toBeNull();
  });

  it('reads en text with a dot decimal and comma groups', () => {
    expect(parseLocaleNumber('1.5', 'en')).toBe(1.5);
    expect(parseLocaleNumber('1,500', 'en')).toBe(1500);
    expect(parseLocaleNumber('1,234,567.25', 'en')).toBe(1234567.25);
    expect(parseLocaleNumber('-1', 'en')).toBe(-1);
    expect(parseLocaleNumber('.5', 'en')).toBe(0.5);
    expect(parseLocaleNumber('5.', 'en')).toBe(5);
  });

  it('reads es text with US conventions (es-US): dot decimal and comma groups', () => {
    expect(parseLocaleNumber('1.5', 'es')).toBe(1.5);
    expect(parseLocaleNumber('1,500', 'es')).toBe(1500);
    expect(parseLocaleNumber('1,234,567.25', 'es')).toBe(1234567.25);
    expect(parseLocaleNumber('-0.25', 'es')).toBe(-0.25);
  });

  it('rejects a separator in the wrong place instead of dropping it', () => {
    expect(parseLocaleNumber('1,5', 'en')).toBeNaN();
    expect(parseLocaleNumber('1,5', 'es')).toBeNaN();
    expect(parseLocaleNumber('0,500', 'en')).toBeNaN();
    expect(parseLocaleNumber('12,34,567', 'en')).toBeNaN();
  });

  it('rejects partial and non-numeric text', () => {
    for (const text of ['-', '+', '.', '1e3', '1e', 'abc', '1 500', '--1']) {
      expect(parseLocaleNumber(text, 'en')).toBeNaN();
    }
  });
});

describe('formatLocaleNumber', () => {
  it('formats without rounding and only groups on request', () => {
    expect(formatLocaleNumber(1500.1234, 'en')).toBe('1500.1234');
    expect(formatLocaleNumber(1500.25, 'es')).toBe('1500.25');
    expect(formatLocaleNumber(1234567.5, 'en', true)).toBe('1,234,567.5');
    expect(formatLocaleNumber(1234567.5, 'es', true)).toBe('1,234,567.5');
  });

  it('pads to the minimum fraction digits without rounding longer values', () => {
    expect(formatLocaleNumber(74, 'en', false, 2)).toBe('74.00');
    expect(formatLocaleNumber(42.5, 'es', false, 2)).toBe('42.50');
    expect(formatLocaleNumber(0.3334, 'en', false, 2)).toBe('0.3334');
  });

  it('round-trips through parseLocaleNumber', () => {
    for (const lang of ['en', 'es']) {
      for (const value of [0, -3.5, 0.0001, 98765.4321, 1234567.89]) {
        expect(parseLocaleNumber(formatLocaleNumber(value, lang, true), lang)).toBe(value);
      }
    }
  });
});

describe('decimalPlaces', () => {
  it('counts digits after the point, including exponent forms', () => {
    expect(decimalPlaces(1)).toBe(0);
    expect(decimalPlaces('0.0001')).toBe(4);
    expect(decimalPlaces(12.345)).toBe(3);
    expect(decimalPlaces(0.0000001)).toBe(7);
    expect(decimalPlaces(1.5e-7)).toBe(8);
  });
});
