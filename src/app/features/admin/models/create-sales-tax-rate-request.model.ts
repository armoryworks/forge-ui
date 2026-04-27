/**
 * Sales-tax-rate create payload. Phase 3 F5 extends with exemptFlag (local
 * concern) and glPostingAccount (external accounting integration concern).
 */
export interface CreateSalesTaxRateRequest {
  name: string;
  code: string;
  stateCode: string | null;
  rate: number;
  effectiveFrom: string | null;
  isDefault: boolean;
  description: string | null;
  // F5 — full-record fields. Both optional.
  exemptFlag?: boolean;
  glPostingAccount?: string | null;
}
