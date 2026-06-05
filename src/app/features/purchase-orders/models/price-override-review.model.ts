/**
 * AI-assisted price-override variance review (forge#6). Mirrors the .NET
 * ReviewPriceOverrideRequestModel / ReviewPriceOverrideResponseModel.
 *
 * The PO dialog can call this when a buyer overrides a default-filled unit price
 * to surface the deterministic variance + an (optional) AI risk assessment and a
 * suggested justification to record. Degrades gracefully: `aiAvailable=false`
 * still returns a deterministic assessment.
 */
export interface PriceOverrideReviewRequest {
  vendorId: number;
  partId: number;
  quantity: number;
  purchaseUnitId: number | null;
  enteredUnitPrice: number;
  reason?: string | null;
}

export interface PriceOverrideReviewResponse {
  tierPrice: number | null;
  variancePct: number | null;
  isOffTier: boolean;
  riskLevel: 'Low' | 'Medium' | 'High';
  assessment: string;
  suggestedJustification: string;
  aiAvailable: boolean;
}
