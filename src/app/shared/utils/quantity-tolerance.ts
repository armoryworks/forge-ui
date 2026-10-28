import { HttpErrorResponse } from '@angular/common/http';

import { QuantityToleranceViolation } from '../models/quantity-tolerance-violation.model';

export const QUANTITY_TOLERANCE_CODE = 'quantity-tolerance';

/** The over-tolerance details of a 409 the server raised because a receipt or shipment went past its band, or null. */
export function quantityToleranceViolationOf(error: unknown): QuantityToleranceViolation | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return null;
  const body = error.error as { code?: string; tolerance?: QuantityToleranceViolation } | null;
  return body?.code === QUANTITY_TOLERANCE_CODE && body.tolerance && typeof body.tolerance === 'object' ? body.tolerance : null;
}

/** How much more can be taken against a line before it needs an over-tolerance override (never negative). */
export function roomWithinTolerance(maxAccepted: number, alreadyDone: number): number {
  return Math.max(0, roundQuantity(maxAccepted - alreadyDone));
}

/** True when adding `quantity` brings a line inside its under tolerance short of the full ordered quantity. */
export function closesWithinTolerance(ordered: number, minComplete: number, alreadyDone: number, quantity: number): boolean {
  const total = alreadyDone + quantity;
  return quantity > 0 && total < ordered && total >= minComplete;
}

function roundQuantity(value: number): number {
  return Math.round(value * 10000) / 10000;
}
