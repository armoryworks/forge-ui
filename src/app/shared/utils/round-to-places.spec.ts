import { describe, expect, it } from 'vitest';

import { roundToPlaces } from './round-to-places';

describe('roundToPlaces', () => {
  it('removes binary artefacts', () => {
    expect(roundToPlaces(0.75 * 25.4, 4)).toBe(19.05);
    expect(roundToPlaces(19.05 / 25.4, 4)).toBe(0.75);
    expect(roundToPlaces(0.1 + 0.2, 10)).toBe(0.3);
  });

  it('rounds half away from zero', () => {
    expect(roundToPlaces(1.005, 2)).toBe(1.01);
    expect(roundToPlaces(-1.005, 2)).toBe(-1.01);
    expect(roundToPlaces(2.5, 0)).toBe(3);
    expect(roundToPlaces(-2.5, 0)).toBe(-3);
  });

  it('keeps zero unsigned', () => {
    expect(Object.is(roundToPlaces(-0.00001, 2), 0)).toBe(true);
  });
});
