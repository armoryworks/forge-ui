export interface VendorCreditMemoLineRequest {
  quantity: number;
  unitPrice: number;
  vendorBillLineId?: number | null;
  partId?: number | null;
  description?: string | null;
  accountDeterminationKey?: string | null;
  glAccountId?: number | null;
}
