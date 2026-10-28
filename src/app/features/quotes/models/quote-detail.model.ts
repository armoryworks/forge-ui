import { TaxOverrideReason } from '../../../shared/models/tax-override-reason.type';
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
  taxOverrideReason?: TaxOverrideReason | null;
  taxOverrideNote?: string | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  sourceEstimateId: number | null;
  lines: QuoteLine[];
  createdAt: Date;
  updatedAt: Date;
  currencyId?: number | null;
  currencyCode?: string | null;
  fxRate?: number;
}
