import { CreateQuoteLineRequest } from './create-quote-line-request.model';

export interface CreateQuoteRequest {
  customerId: number;
  /** Optional manual override; blank/omitted → server auto-generates. Gated by the `quotes.allow_manual_numbers` setting. */
  quoteNumber?: string;
  shippingAddressId?: number;
  expirationDate?: string;
  notes?: string;
  taxRate: number;
  customerPO?: string;
  lines: CreateQuoteLineRequest[];
}
