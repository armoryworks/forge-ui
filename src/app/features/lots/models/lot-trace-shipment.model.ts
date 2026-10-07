export interface LotTraceShipment {
  shipmentId: number;
  shipmentNumber: string;
  customerId: number;
  customerName: string;
  shippedDate: Date | null;
  quantity: number;
}
