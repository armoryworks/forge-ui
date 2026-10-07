import { describe, it, expect } from 'vitest';

import {
  resolveAutoLinePrice,
  classifyManualOverride,
  commitLinePrice,
  confirmLinePriceReason,
  cancelLinePriceReason,
  LinePriceGateState,
  LinePriceGateContext,
  PricingVendorRow,
} from './po-line-price.util';

const tier = (minQuantity: number, unitPrice: number, purchaseUnitId: number | null = null) =>
  ({ minQuantity, unitPrice, purchaseUnitId });

describe('resolveAutoLinePrice (forge#8 — PO add-line auto price)', () => {
  it('returns null when there are no rows and no effective price', () => {
    expect(resolveAutoLinePrice([], 1, 10, null)).toBeNull();
  });

  it('falls back to the part effective price when no tier matches', () => {
    expect(resolveAutoLinePrice([], 1, 10, null, 7.25)).toBe(7.25);
  });

  it('ignores a zero/negative effective price fallback', () => {
    expect(resolveAutoLinePrice([], 1, 10, null, 0)).toBeNull();
    expect(resolveAutoLinePrice([], 1, 10, null, -5)).toBeNull();
  });

  it('picks the highest MinQuantity break the qty qualifies for', () => {
    const rows: PricingVendorRow[] = [
      { vendorId: 1, priceTiers: [tier(1, 10), tier(50, 8), tier(100, 6)] },
    ];
    expect(resolveAutoLinePrice(rows, 1, 75, null)).toBe(8);   // 50 break, not 100
    expect(resolveAutoLinePrice(rows, 1, 100, null)).toBe(6);  // exactly the 100 break
    expect(resolveAutoLinePrice(rows, 1, 1, null)).toBe(10);
  });

  it('prefers the selected vendor row over other vendors', () => {
    const rows: PricingVendorRow[] = [
      { vendorId: 2, priceTiers: [tier(1, 4)] },
      { vendorId: 1, priceTiers: [tier(1, 9)] },
    ];
    expect(resolveAutoLinePrice(rows, 1, 1, null)).toBe(9);   // vendor 1 wins despite being pricier
    expect(resolveAutoLinePrice(rows, 2, 1, null)).toBe(4);
  });

  it('matches tiers for the chosen purchase option, falling back to per-base (null) tiers', () => {
    const rows: PricingVendorRow[] = [
      { vendorId: 1, priceTiers: [tier(1, 50, 7), tier(1, 0.6, null)] },
    ];
    // Option 7 selected → its per-option price.
    expect(resolveAutoLinePrice(rows, 1, 1, 7)).toBe(50);
    // No option → the per-base tier.
    expect(resolveAutoLinePrice(rows, 1, 1, null)).toBe(0.6);
    // A different option with no matching tier → only the null tier qualifies.
    expect(resolveAutoLinePrice(rows, 1, 1, 99)).toBe(0.6);
  });

  it('treats a null/zero qty as 0 (only MinQuantity<=0 tiers, else fallback)', () => {
    const rows: PricingVendorRow[] = [{ vendorId: 1, priceTiers: [tier(1, 10)] }];
    expect(resolveAutoLinePrice(rows, 1, null, null, 3)).toBe(3); // no tier qualifies → effective price
  });
});

describe('classifyManualOverride (forge#8 — override permission + reason gating)', () => {
  const base = { lastComputedPrice: 10, newValue: 12 };

  it('accepts freely when the price was not a default fill', () => {
    expect(classifyManualOverride({ ...base, priceIsDefault: false, canOverride: false }))
      .toBe('accept');
  });

  it('accepts when the value did not actually change off the computed default', () => {
    expect(classifyManualOverride({ priceIsDefault: true, canOverride: false, lastComputedPrice: 10, newValue: 10 }))
      .toBe('accept');
  });

  it('accepts when there is no computed baseline to compare against', () => {
    expect(classifyManualOverride({ priceIsDefault: true, canOverride: false, lastComputedPrice: null, newValue: 12 }))
      .toBe('accept');
  });

  it('denies a non-privileged user changing a default price', () => {
    expect(classifyManualOverride({ ...base, priceIsDefault: true, canOverride: false }))
      .toBe('deny-permission');
  });

  it('requires a reason when a privileged user changes a default price', () => {
    expect(classifyManualOverride({ ...base, priceIsDefault: true, canOverride: true }))
      .toBe('needs-reason');
  });
});

describe('commitLinePrice / reason dialog (price edit gate on blur and Add)', () => {
  const ctx: LinePriceGateContext = { canOverride: true, lastComputedPrice: 10, defaultFilledPrice: 10 };
  const edited: LinePriceGateState = { unitPrice: 12, priceIsDefault: true, reasonDialogOpen: false, overrideReason: null };

  it('blocks Add and changes nothing while the reason dialog is open', () => {
    const open = { ...edited, reasonDialogOpen: true };
    const result = commitLinePrice(open, ctx);
    expect(result.canAdd).toBe(false);
    expect(result.notice).toBeNull();
    expect(result.state).toEqual(open);
  });

  it('opens the reason dialog and blocks Add when a privileged user edits a default price', () => {
    const result = commitLinePrice(edited, ctx);
    expect(result.canAdd).toBe(false);
    expect(result.state.reasonDialogOpen).toBe(true);
    expect(result.state.unitPrice).toBe(12);
  });

  it('reverts to the computed price and blocks Add when the user lacks override rights', () => {
    const result = commitLinePrice(edited, { ...ctx, canOverride: false });
    expect(result.canAdd).toBe(false);
    expect(result.state.unitPrice).toBe(10);
    expect(result.state.reasonDialogOpen).toBe(false);
    expect(result.notice).toBe('purchaseOrders.overrideRequiresPermission');
  });

  it('accepts an unchanged default price and keeps it marked as default', () => {
    const result = commitLinePrice({ ...edited, unitPrice: 10 }, ctx);
    expect(result.canAdd).toBe(true);
    expect(result.state.priceIsDefault).toBe(true);
  });

  it('accepts a price typed with no computed baseline and clears the default marker', () => {
    const result = commitLinePrice(edited, { ...ctx, lastComputedPrice: null });
    expect(result.canAdd).toBe(true);
    expect(result.state.priceIsDefault).toBe(false);
  });

  it('keeps the edited price and records the reason on confirm', () => {
    const opened = commitLinePrice(edited, ctx).state;
    const result = confirmLinePriceReason(opened, 'Vendor quote 2026-10');
    expect(result.state).toEqual({ unitPrice: 12, priceIsDefault: false, reasonDialogOpen: false, overrideReason: 'Vendor quote 2026-10' });
    expect(result.notice).toBe('purchaseOrders.overrideRecorded');
    expect(commitLinePrice(result.state, ctx).canAdd).toBe(true);
  });

  it('restores the computed price on cancel, after which Add goes ahead at that price', () => {
    const opened = commitLinePrice(edited, ctx).state;
    const result = cancelLinePriceReason(opened, ctx);
    expect(result.state.unitPrice).toBe(10);
    expect(result.state.reasonDialogOpen).toBe(false);
    expect(result.state.overrideReason).toBeNull();
    expect(result.notice).toBe('purchaseOrders.overrideRequiresReason');
    const retry = commitLinePrice(result.state, ctx);
    expect(retry.canAdd).toBe(true);
    expect(retry.state.priceIsDefault).toBe(true);
  });
});
