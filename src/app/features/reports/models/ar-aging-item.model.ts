export interface ArAgingItem {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  daysOverdue: number;
  agingBucket: string;
}
