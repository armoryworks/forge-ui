export interface ArAgingItem {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: Date;
  dueDate: Date;
  total: number;
  amountPaid: number;
  balanceDue: number;
  daysOverdue: number;
  agingBucket: string;
}
