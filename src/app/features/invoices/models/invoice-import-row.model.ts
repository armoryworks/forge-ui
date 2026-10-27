/** One CSV row of a historical invoice import; rows sharing an invoice number are one invoice. */
export interface InvoiceImportRow {
  rowKey: string;
  invoiceNumber: string | null;
  customer: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  part: string | null;
  description: string | null;
  quantity: number | null;
  unitPrice: number | null;
  tax: number | null;
  total: number | null;
  paidAmount: number | null;
  paidDate: string | null;
  status: string | null;
  customerPO: string | null;
}
