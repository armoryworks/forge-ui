export interface AddPurchaseOrderLineRequest {
  partId: number | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
