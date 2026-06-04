/**
 * Pure pricing helpers for the PO add-line row, extracted from
 * PoDialogComponent so the auto-fill + manual-override rules are unit-testable
 * without the dialog's HTTP / form / window.prompt plumbing (forge#8).
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
