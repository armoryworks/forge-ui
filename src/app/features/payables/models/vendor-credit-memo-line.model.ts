export interface VendorCreditMemoLine {
  id: number;
  lineNumber: number;
  vendorBillLineId: number | null;
  vendorReturnLineId: number | null;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  accountDeterminationKey: string;
  glAccountId: number | null;
}
