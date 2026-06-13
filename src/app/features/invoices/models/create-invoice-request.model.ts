import { CreateInvoiceLineRequest } from './create-invoice-line-request.model';

export interface CreateInvoiceRequest {
  customerId: number;
  salesOrderId?: number;
  shipmentId?: number;
  invoiceDate: string;
  dueDate: string;
  creditTerms?: string;
  taxRate: number;
  notes?: string;
  /**
   * Multi-currency (additive). Null/omitted → the active book's functional
   * (base) currency. Single-currency installs leave this unset.
   */
  currencyId?: number;
  /** Booking FX rate (txn → functional). Defaults to 1 for the base currency. */
  fxRate?: number;
  lines: CreateInvoiceLineRequest[];
}
