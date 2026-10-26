import { describe, expect, it } from 'vitest';

import { tieOutDifference } from './opening-open-items-lines';

describe('tieOutDifference', () => {
  it('is the party total less the control, to the cent, and null until the control is entered', () => {
    expect(tieOutDifference(1500, 1500)).toBe(0);
    expect(tieOutDifference(1500.1, 1500)).toBe(0.1);
    expect(tieOutDifference(1400, 1500)).toBe(-100);
    expect(tieOutDifference(1500, null)).toBeNull();
  });
});
