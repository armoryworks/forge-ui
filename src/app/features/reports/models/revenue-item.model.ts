export interface RevenueItem {
  period: string;
  customerName: string | null;
  invoiceCount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
}
