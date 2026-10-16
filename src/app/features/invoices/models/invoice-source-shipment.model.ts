import { InvoiceSourceShipmentLine } from './invoice-source-shipment-line.model';

export interface InvoiceSourceShipment {
  id: number;
  shipmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  shippedDate: string | null;
  lines: InvoiceSourceShipmentLine[];
}
