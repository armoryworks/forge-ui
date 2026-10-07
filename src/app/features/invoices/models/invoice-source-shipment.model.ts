export interface InvoiceSourceShipment {
  id: number;
  shipmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  shippedDate: string | null;
}
