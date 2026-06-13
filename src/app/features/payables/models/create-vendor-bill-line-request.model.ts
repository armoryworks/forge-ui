// ⚡ ACCOUNTING BOUNDARY — one line of a CreateVendorBillRequest. When the bill
// is PO-linked, every line must carry purchaseOrderLineId (and none may when
// the bill is standalone).
export interface CreateVendorBillLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  accountDeterminationKey?: string;
  purchaseOrderLineId?: number;
}
