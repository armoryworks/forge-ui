/**
 * Bought-parts effort PR4 — tier-variance check models. Mirrors
 * `Forge.Core.Models.CheckTierVarianceRequestModel` and
 * `CheckTierVarianceResponseModel` exactly.
 *
 * The PO dialog calls `POST /api/v1/vendor-parts/check-tier-variance`
 * at save time with every line. Lines flagged `isOffTier` drive the
 * consolidated off-tier prompt — one dialog for the whole PO, not
 * one prompt per line.
 */
export interface CheckTierVarianceRequest {
  vendorId: number;
  lines: CheckTierVarianceLine[];
}

export interface CheckTierVarianceLine {
  partId: number;
  quantity: number;
  unitPrice: number;
  /** The purchase option the price/qty are in (null = per base unit). The
   *  server matches the tier for the same option so the comparison is
   *  apples-to-apples. */
  purchaseUnitId?: number | null;
}

export interface CheckTierVarianceResponse {
  thresholdPct: number;
  lines: CheckTierVarianceResult[];
}

export interface CheckTierVarianceResult {
  partId: number;
  quantity: number;
  unitPrice: number;
  vendorPartId: number | null;
  tierPrice: number | null;
  currency: string | null;
  variancePct: number | null;
  isOffTier: boolean;
}
