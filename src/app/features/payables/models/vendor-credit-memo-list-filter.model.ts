export interface VendorCreditMemoListFilter {
  vendorId?: number | null;
  status?: string | null;
  vendorBillId?: number | null;
  currencyId?: number | null;
  openOnly?: boolean;
  q?: string | null;
}
