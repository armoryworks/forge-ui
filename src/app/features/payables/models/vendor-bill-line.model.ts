// ⚡ ACCOUNTING BOUNDARY — one line of a VendorBillDetail. PurchaseOrderLineId
// is non-null on PO-matched (3-way-match) bills.
export interface VendorBillLine {
  id: number;
  lineNumber: number;
  partId: number | null;
  purchaseOrderLineId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  accountDeterminationKey: string;
}
