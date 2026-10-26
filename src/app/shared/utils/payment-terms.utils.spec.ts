import { describe, it, expect } from 'vitest';

import { automaticDiscount, discountDateForTerms, dueDateForTerms, hasDiscount, inDiscountWindow } from './payment-terms.utils';

const twoTenNet30 = { netDays: 30, discountPercent: 2, discountDays: 10 };

describe('payment terms utils', () => {
  it('dates the due and discount dates from the document date, across month ends', () => {
    const jan25 = new Date(2026, 0, 25);
    expect(dueDateForTerms(jan25, twoTenNet30)?.toDateString()).toBe(new Date(2026, 1, 24).toDateString());
    expect(discountDateForTerms(jan25, twoTenNet30)?.toDateString()).toBe(new Date(2026, 1, 4).toDateString());
    expect(discountDateForTerms(jan25, { netDays: 30, discountPercent: 0, discountDays: 0 })).toBeNull();
    expect(dueDateForTerms(jan25, null)).toBeNull();
    expect(hasDiscount(twoTenNet30)).toBe(true);
  });

  it('treats the deadline day as inside the window', () => {
    expect(inDiscountWindow('2026-02-04T00:00:00Z', new Date(2026, 1, 4))).toBe(true);
    expect(inDiscountWindow('2026-02-04T00:00:00Z', new Date(2026, 1, 5))).toBe(false);
    expect(inDiscountWindow(null, new Date(2026, 1, 1))).toBe(false);
  });

  it('takes the rest of the discount on a settling payment and the pro-rata share on a partial one', () => {
    expect(automaticDiscount(9604, 9800, 196, 2)).toBe(196);
    expect(automaticDiscount(9800, 9800, 196, 2)).toBe(0);
    expect(automaticDiscount(4900, 9800, 196, 2)).toBe(100);
    expect(automaticDiscount(100, 9800, 0, 2)).toBe(0);
  });
});
