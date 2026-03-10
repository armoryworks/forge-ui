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
  lines: CreateInvoiceLineRequest[];
}
