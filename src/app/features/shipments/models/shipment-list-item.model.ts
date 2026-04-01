export interface ShipmentListItem {
  id: number;
  shipmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  customerName: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedDate: Date | null;
  createdAt: Date;
}
