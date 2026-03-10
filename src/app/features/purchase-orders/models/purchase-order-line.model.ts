export interface PurchaseOrderLine {
  id: number;
  partId: number;
  partNumber: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
}
