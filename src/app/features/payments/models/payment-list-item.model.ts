export interface PaymentListItem {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  method: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  paymentDate: string;
  referenceNumber: string | null;
  createdAt: string;
}
