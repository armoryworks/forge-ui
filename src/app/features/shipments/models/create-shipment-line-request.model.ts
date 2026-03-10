export interface CreateShipmentLineRequest {
  salesOrderLineId: number;
  quantity: number;
  notes?: string;
}
