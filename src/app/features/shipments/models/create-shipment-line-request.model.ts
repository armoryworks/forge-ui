export interface CreateShipmentLineRequest {
  /** The sales-order line being fulfilled. Drives server-side remaining-qty validation. */
  salesOrderLineId?: number;
  partId?: number;
  quantity: number;
  notes?: string;
}
