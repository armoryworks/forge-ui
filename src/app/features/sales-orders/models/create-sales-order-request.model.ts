import { CreateSalesOrderLineRequest } from './create-sales-order-line-request.model';

export interface CreateSalesOrderRequest {
  customerId: number;
  /** Optional manual override; blank/omitted → server auto-generates. Gated by the `sales_orders.allow_manual_numbers` setting. */
  orderNumber?: string;
  quoteId?: number;
  shippingAddressId?: number;
  billingAddressId?: number;
  creditTerms?: string;
  requestedDeliveryDate?: string;
  customerPO?: string;
  notes?: string;
  taxRate: number;
  lines: CreateSalesOrderLineRequest[];
}
