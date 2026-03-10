export interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
}
