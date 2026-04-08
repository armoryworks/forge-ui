import { QuoteLine } from './quote-line.model';

export interface QuoteDetail {
  id: number;
  quoteNumber: string;
  customerId: number;
  customerName: string;
  shippingAddressId: number | null;
  status: string;
  sentDate: Date | null;
  expirationDate: Date | null;
  acceptedDate: Date | null;
  notes: string | null;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  sourceEstimateId: number | null;
  lines: QuoteLine[];
  createdAt: Date;
  updatedAt: Date;
}
