export interface InvoiceListItem {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  invoiceDate: Date;
  dueDate: Date;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: Date;
}
