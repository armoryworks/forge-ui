import { ReadyToShipLine } from './ready-to-ship-line.model';

/** Shipping workspace: an open sales order with its unshipped lines — one row in the ready-to-ship queue. */
export interface ReadyToShipOrder {
  salesOrderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  shippingAddressId: number | null;
  requestedDeliveryDate: string | null;
  status: string;
  lines: ReadyToShipLine[];
}
