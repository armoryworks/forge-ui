import { CreateQuoteLineRequest } from './create-quote-line-request.model';

export interface CreateQuoteRequest {
  customerId: number;
  shippingAddressId?: number;
  expirationDate?: string;
  notes?: string;
  taxRate: number;
  lines: CreateQuoteLineRequest[];
}
