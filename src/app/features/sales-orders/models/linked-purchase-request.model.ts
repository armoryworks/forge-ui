/** Body for raising a drop-ship or back-to-back purchase order from a sales order line. */
export interface LinkedPurchaseRequest {
  vendorId: number;
  quantity: number | null;
  unitCost: number | null;
  expectedDeliveryDate: string | null;
  notes: string | null;
}
