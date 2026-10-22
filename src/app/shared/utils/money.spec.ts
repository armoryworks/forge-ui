import { describe, expect, it } from 'vitest';

import { decimalPlacesOf, roundMoney } from './money';

describe('roundMoney', () => {
  it.each([
    [0.375, 0.38],
    [9.9995, 10],
    [20.3745, 20.37],
    [1.005, 1.01],
    [2.675, 2.68],
    [-1.005, -1.01],
    [21.85165125, 21.85],
    [0.0049, 0],
    [1234567.891, 1234567.89],
  ])('rounds %s half away from zero to %s', (value, expected) => {
    expect(roundMoney(value)).toBe(expected);
  });
});

describe('decimalPlacesOf', () => {
  it.each([
    [10, 0],
    [10.5, 1],
    [99999.999, 3],
    [0.30000000000000004, 17],
    [1e-7, 7],
    [1.5e-7, 8],
    [1e21, 0],
  ])('counts the decimals of %s as %s', (value, expected) => {
    expect(decimalPlacesOf(value)).toBe(expected);
  });
});
