export interface VendorCreditMemoListItem {
  id: number;
  memoNumber: string;
  kind: string;
  vendorId: number;
  vendorName: string;
  vendorBillId: number | null;
  vendorBillNumber: string | null;
  vendorReturnId: number | null;
  vendorReturnNumber: string | null;
  sourceType: string;
  reason: string;
  vendorReference: string | null;
  status: string;
  memoDate: string;
  total: number;
  amountApplied: number;
  openAmount: number;
  currencyId: number;
  currencyCode: string | null;
  fxRate: number;
  createdAt: string;
}
