import { QuoteLine } from './quote-line.model';

export interface QuoteDetail {
  id: number;
  quoteNumber: string;
  customerId: number;
  customerName: string;
  shippingAddressId: number | null;
  status: string;
  sentDate: string | null;
  expirationDate: string | null;
  acceptedDate: string | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  lines: QuoteLine[];
  createdAt: string;
  updatedAt: string;
}
