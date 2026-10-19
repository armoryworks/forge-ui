import { describe, expect, it } from 'vitest';

import { roundMoney } from './money.utils';

describe('roundMoney', () => {
  it('rounds a half cent up', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it('rounds a float product that lands just under the half cent', () => {
    expect(roundMoney(3 * 33.335)).toBe(100.01);
  });

  it('rounds a negative half cent away from zero', () => {
    expect(roundMoney(-1.005)).toBe(-1.01);
    expect(roundMoney(-0.125)).toBe(-0.13);
  });

  it('leaves whole cents and zero alone', () => {
    expect(roundMoney(107.28)).toBe(107.28);
    expect(roundMoney(0)).toBe(0);
    expect(Object.is(roundMoney(-0.001), 0)).toBe(true);
  });
});
