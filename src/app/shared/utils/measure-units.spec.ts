import { describe, expect, it } from 'vitest';

import {
  fromCanonicalMeasure, measureDisplayUnit, measureUnitOptions, toCanonicalMeasure,
} from './measure-units';

function roundTrip(kind: 'length' | 'weight' | 'volume', value: number, unit: string): number | null {
  return fromCanonicalMeasure(kind, toCanonicalMeasure(kind, value, unit), unit);
}

describe('measure units', () => {
  it('stores 0.75 in as 19.05 mm and reads it back as 0.75', () => {
    expect(toCanonicalMeasure('length', 0.75, 'in')).toBe(19.05);
    expect(fromCanonicalMeasure('length', 19.05, 'in')).toBe(0.75);
    expect(roundTrip('length', 0.75, 'in')).toBe(0.75);
  });

  it('round-trips 13/16 in as 0.8125', () => {
    expect(toCanonicalMeasure('length', 13 / 16, 'in')).toBe(20.6375);
    expect(roundTrip('length', 13 / 16, 'in')).toBe(0.8125);
  });

  it('round-trips common values in every length unit', () => {
    for (const [value, unit] of [[12.7, 'mm'], [1.27, 'cm'], [0.0127, 'm'], [1.1875, 'in'], [2.5, 'ft']] as const) {
      expect(roundTrip('length', value, unit)).toBe(value);
    }
  });

  it('rounds the display to the unit precision', () => {
    expect(fromCanonicalMeasure('length', 0.7938, 'in')).toBe(0.0313);
    expect(fromCanonicalMeasure('length', 1.23456, 'mm')).toBe(1.235);
    expect(fromCanonicalMeasure('length', 20.6375, 'ft')).toBe(0.0677);
  });

  it('round-trips weights and volumes', () => {
    expect(roundTrip('weight', 0.75, 'lb')).toBe(0.75);
    expect(roundTrip('weight', 3.3, 'oz')).toBe(3.3);
    expect(roundTrip('weight', 1.25, 'kg')).toBe(1.25);
    expect(roundTrip('volume', 0.3, 'gal')).toBe(0.3);
    expect(roundTrip('volume', 1.5, 'L')).toBe(1.5);
  });

  it('passes null through', () => {
    expect(toCanonicalMeasure('length', null, 'in')).toBeNull();
    expect(fromCanonicalMeasure('weight', null, 'lb')).toBeNull();
  });

  it('falls back to the canonical unit for an unknown or missing unit', () => {
    expect(measureDisplayUnit('length', 'yd')).toBe('mm');
    expect(measureDisplayUnit('weight', null)).toBe('g');
    expect(measureDisplayUnit('volume', 'gal')).toBe('gal');
    expect(toCanonicalMeasure('length', 5, 'yd')).toBe(5);
  });

  it('lists the units canonical first', () => {
    expect(measureUnitOptions('length').map(o => o.value)).toEqual(['mm', 'cm', 'm', 'in', 'ft']);
    expect(measureUnitOptions('weight').map(o => o.value)).toEqual(['g', 'kg', 'lb', 'oz']);
    expect(measureUnitOptions('volume').map(o => o.value)).toEqual(['mL', 'L', 'gal']);
  });
});
