import { SalesOrderLine } from './sales-order-line.model';
import { SalesOrderShipment } from './sales-order-shipment.model';
import { SalesOrderReturn } from './sales-order-return.model';

export interface SalesOrderDetail {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  quoteId: number | null;
  quoteNumber: string | null;
  shippingAddressId: number | null;
  billingAddressId: number | null;
  status: string;
  creditTerms: string | null;
  confirmedDate: Date | null;
  requestedDeliveryDate: Date | null;
  customerPO: string | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  lines: SalesOrderLine[];
  shipments: SalesOrderShipment[];
  returns: SalesOrderReturn[];
  createdAt: Date;
  updatedAt: Date;
}
