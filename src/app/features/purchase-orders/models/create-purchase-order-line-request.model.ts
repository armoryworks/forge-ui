export interface CreatePurchaseOrderLineRequest {
  partId: number;
  orderedQuantity: number;
  unitPrice: number;
  notes?: string;
}
