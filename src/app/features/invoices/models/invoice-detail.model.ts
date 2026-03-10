import { InvoiceLine } from './invoice-line.model';

export interface InvoiceDetail {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  salesOrderId: number | null;
  salesOrderNumber: string | null;
  shipmentId: number | null;
  shipmentNumber: string | null;
  status: string;
  invoiceDate: string;
  dueDate: string;
  creditTerms: string | null;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  lines: InvoiceLine[];
  createdAt: string;
  updatedAt: string;
}
