import { CreateShipmentLineRequest } from './create-shipment-line-request.model';

export interface CreateShipmentRequest {
  salesOrderId: number;
  // Optional manual override for the auto-generated shipment number. Only
  // honored server-side when shipments.allow_manual_numbers is enabled; blank
  // (undefined) means auto-generate.
  shipmentNumber?: string;
  shippingAddressId?: number;
  carrier?: string;
  carrierId?: number;
  trackingNumber?: string;
  shippingCost?: number;
  weight?: number;
  notes?: string;
  lines: CreateShipmentLineRequest[];
}
