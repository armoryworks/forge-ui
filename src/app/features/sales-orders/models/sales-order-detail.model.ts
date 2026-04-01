import { SalesOrderLine } from './sales-order-line.model';

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
  createdAt: Date;
  updatedAt: Date;
}
