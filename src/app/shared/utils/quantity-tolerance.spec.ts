import { describe, it, expect } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';

import { closesWithinTolerance, quantityToleranceViolationOf, roomWithinTolerance } from './quantity-tolerance';

describe('quantity tolerance helpers', () => {
  it('reads the violation from a quantity-tolerance 409 only', () => {
    const tolerance = { kind: 'purchase-receipt', lineId: 3, ordered: 100, alreadyDone: 0, requested: 120, maxAccepted: 110, overPercent: 10, underPercent: 10, canOverride: true };
    expect(quantityToleranceViolationOf(new HttpErrorResponse({ status: 409, error: { code: 'quantity-tolerance', tolerance } }))).toEqual(tolerance);
    expect(quantityToleranceViolationOf(new HttpErrorResponse({ status: 409, error: { code: 'step-gate', tolerance } }))).toBeNull();
    expect(quantityToleranceViolationOf(new HttpErrorResponse({ status: 400, error: { code: 'quantity-tolerance', tolerance } }))).toBeNull();
    expect(quantityToleranceViolationOf(new Error('x'))).toBeNull();
  });

  it('gives the room left before an override, never negative', () => {
    expect(roomWithinTolerance(110, 95)).toBe(15);
    expect(roomWithinTolerance(110, 120)).toBe(0);
    expect(roomWithinTolerance(5.5, 1.2)).toBe(4.3);
  });

  it('knows when a quantity closes a line inside its under tolerance', () => {
    expect(closesWithinTolerance(100, 90, 0, 92)).toBe(true);
    expect(closesWithinTolerance(100, 90, 0, 89)).toBe(false);
    expect(closesWithinTolerance(100, 90, 0, 100)).toBe(false);
    expect(closesWithinTolerance(100, 90, 50, 0)).toBe(false);
  });
});
