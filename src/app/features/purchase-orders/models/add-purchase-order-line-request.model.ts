export interface AddPurchaseOrderLineRequest {
  partId: number | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  /** Receipt tolerance for the line; omitted copies the vendor's. */
  overReceiptTolerancePct?: number;
  underReceiptTolerancePct?: number;
}
