import { describe, it, expect } from 'vitest';

import { defaultLotExpiry } from './lot-expiry';

describe('defaultLotExpiry', () => {
  it('adds the shelf life to today as a calendar date', () => {
    expect(defaultLotExpiry(45, new Date(2026, 9, 26, 15, 30))).toEqual(new Date(2026, 11, 10));
  });

  it('gives no expiry without a shelf life', () => {
    expect(defaultLotExpiry(null)).toBeNull();
    expect(defaultLotExpiry(0)).toBeNull();
  });
});
