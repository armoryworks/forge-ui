import { CreateShipmentLineRequest } from './create-shipment-line-request.model';

export interface CreateShipmentRequest {
  salesOrderId: number;
  shippingAddressId?: number;
  carrier?: string;
  trackingNumber?: string;
  shippingCost?: number;
  weight?: number;
  notes?: string;
  lines: CreateShipmentLineRequest[];
}
