import { CreateSalesOrderLineRequest } from './create-sales-order-line-request.model';

export interface CreateSalesOrderRequest {
  customerId: number;
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
