import { ShipmentLine } from './shipment-line.model';

export interface ShipmentDetail {
  id: number;
  shipmentNumber: string;
  salesOrderId: number;
  salesOrderNumber: string;
  customerName: string;
  customerId: number;
  shippingAddressId: number | null;
  status: string;
  carrier: string | null;
  carrierIsApi: boolean;
  carrierRequiresScanToShip: boolean;
  trackingNumber: string | null;
  shippedDate: Date | null;
  deliveredDate: Date | null;
  shippingCost: number | null;
  freightCharge?: number | null;
  freightTerms?: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  notes: string | null;
  invoiceId: number | null;
  invoiceNumber?: string | null;
  lines: ShipmentLine[];
  createdAt: Date;
  updatedAt: Date;
}
