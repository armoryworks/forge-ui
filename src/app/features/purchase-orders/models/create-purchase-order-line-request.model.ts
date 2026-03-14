export interface CreatePurchaseOrderLineRequest {
  partId: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
