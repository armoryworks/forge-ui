import { ShipmentLine } from './shipment-line.model';

export interface ShipmentDetail {
  id: number;
  shipmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  customerName: string;
  shippingAddressId: number | null;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedDate: Date | null;
  deliveredDate: Date | null;
  shippingCost: number | null;
  weight: number | null;
  notes: string | null;
  invoiceId: number | null;
  lines: ShipmentLine[];
  createdAt: Date;
  updatedAt: Date;
}
