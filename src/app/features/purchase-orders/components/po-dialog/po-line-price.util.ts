/**
 * Pure pricing helpers for the PO add-line row, extracted from
 * PoDialogComponent so the auto-fill + manual-override rules are unit-testable
 * without the dialog's HTTP / form / reason-dialog plumbing (forge#8).
 */

/** Minimal structural shapes — VendorPart / VendorPartPriceTier satisfy these. */
export interface PricingTier {
  purchaseUnitId: number | null;
  minQuantity: number;
  unitPrice: number;
}
export interface PricingVendorRow {
  vendorId: number;
  priceTiers: PricingTier[];
}

/**
 * Resolve the auto-fill unit price for a PO line.
 *
 * Order of preference:
 *  1. The selected vendor's row first, then the remaining vendors.
 *  2. Within a row, tiers matching the chosen purchase option OR priced per
 *     base unit (purchaseUnitId === null), whose MinQuantity the requested qty
 *     qualifies for — the highest such break wins.
 *  3. If no tier matches anywhere, fall back to the part's effective price
 *     (only when > 0).
 *
 * Returns null when nothing applies (caller leaves the field untouched).
 */
export function resolveAutoLinePrice(
  rows: PricingVendorRow[],
  vendorId: number | null,
  qty: number | null,
  purchaseUnitId: number | null,
  partEffectivePrice?: number | null,
): number | null {
  const effectiveQty = qty ?? 0;
  const vendorRow = vendorId != null ? rows.find(r => r.vendorId === vendorId) : undefined;
  const candidateRows = vendorRow
    ? [vendorRow, ...rows.filter(r => r.vendorId !== vendorId)]
    : rows;

  for (const row of candidateRows) {
    const tiers = row.priceTiers
      .filter(t => t.purchaseUnitId === purchaseUnitId || t.purchaseUnitId === null)
      .filter(t => t.minQuantity <= effectiveQty)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    if (tiers.length > 0) return tiers[0].unitPrice;
  }

  if (partEffectivePrice != null && partEffectivePrice > 0) return partEffectivePrice;
  return null;
}

/**
 * How a manual edit to a default-filled unit price should be handled:
 *  - 'accept'         — no gating (price wasn't default, or the value didn't
 *                       actually change off the computed default).
 *  - 'deny-permission'— user lacks override rights and changed the value → revert.
 *  - 'needs-reason'   — privileged user changed the value → prompt for a reason.
 */
export type OverrideClassification = 'accept' | 'deny-permission' | 'needs-reason';

export function classifyManualOverride(params: {
  priceIsDefault: boolean;
  canOverride: boolean;
  lastComputedPrice: number | null;
  newValue: number | null;
}): OverrideClassification {
  const { priceIsDefault, canOverride, lastComputedPrice, newValue } = params;
  if (!priceIsDefault) return 'accept';
  const changed = lastComputedPrice !== null && newValue !== lastComputedPrice;
  if (!changed) return 'accept';
  return canOverride ? 'needs-reason' : 'deny-permission';
}

/** The add-line row's price state that the override gate reads and rewrites. */
export interface LinePriceGateState {
  unitPrice: number | null;
  priceIsDefault: boolean;
  reasonDialogOpen: boolean;
  overrideReason: string | null;
}

/** Inputs to the override gate that it never changes. */
export interface LinePriceGateContext {
  canOverride: boolean;
  lastComputedPrice: number | null;
  defaultFilledPrice: number | null;
}

/** Translation key of the snackbar to show after a gate step (null = none). */
export type LinePriceGateNotice =
  | 'purchaseOrders.overrideRequiresPermission'
  | 'purchaseOrders.overrideRequiresReason'
  | 'purchaseOrders.overrideRecorded'
  | null;

/** Next state, the snackbar to show, and whether the pending Add may go ahead. */
export interface LinePriceGateResult {
  state: LinePriceGateState;
  notice: LinePriceGateNotice;
  canAdd: boolean;
}

/**
 * The price field lost focus or Add was clicked. While the reason dialog is
 * open nothing changes and Add waits; a denied edit reverts to the computed
 * price; a privileged edit opens the reason dialog; anything else is accepted.
 */
export function commitLinePrice(state: LinePriceGateState, ctx: LinePriceGateContext): LinePriceGateResult {
  if (state.reasonDialogOpen) return { state, notice: null, canAdd: false };
  const classification = classifyManualOverride({
    priceIsDefault: state.priceIsDefault,
    canOverride: ctx.canOverride,
    lastComputedPrice: ctx.lastComputedPrice,
    newValue: state.unitPrice,
  });
  if (classification === 'deny-permission') {
    return {
      state: { ...state, unitPrice: ctx.lastComputedPrice },
      notice: 'purchaseOrders.overrideRequiresPermission',
      canAdd: false,
    };
  }
  if (classification === 'needs-reason') {
    return { state: { ...state, reasonDialogOpen: true }, notice: null, canAdd: false };
  }
  return {
    state: { ...state, priceIsDefault: state.priceIsDefault && state.unitPrice === ctx.defaultFilledPrice },
    notice: null,
    canAdd: true,
  };
}

/** The reason dialog was confirmed: keep the edited price and remember the reason. */
export function confirmLinePriceReason(state: LinePriceGateState, reason: string): LinePriceGateResult {
  return {
    state: { ...state, reasonDialogOpen: false, priceIsDefault: false, overrideReason: reason },
    notice: 'purchaseOrders.overrideRecorded',
    canAdd: false,
  };
}

/** The reason dialog was cancelled: put the computed price back. */
export function cancelLinePriceReason(state: LinePriceGateState, ctx: LinePriceGateContext): LinePriceGateResult {
  return {
    state: { ...state, reasonDialogOpen: false, unitPrice: ctx.lastComputedPrice },
    notice: 'purchaseOrders.overrideRequiresReason',
    canAdd: false,
  };
}
