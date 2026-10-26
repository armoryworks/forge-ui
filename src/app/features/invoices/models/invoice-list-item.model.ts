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
  currencyCode?: string | null;
  currencyId?: number | null;
  fxRate?: number;
  totalFunctional?: number | null;
  paymentTermsId?: number | null;
  discountPercent?: number;
  discountDueDate?: Date | string | null;
  discountDeadline?: Date | string | null;
  discountsTaken?: number;
  discountAvailable?: number;
}
