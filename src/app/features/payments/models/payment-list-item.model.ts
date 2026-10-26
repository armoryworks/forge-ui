export interface PaymentListItem {
  id: number;
  paymentNumber: string;
  customerId: number;
  customerName: string;
  method: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  paymentDate: Date;
  referenceNumber: string | null;
  createdAt: Date;
  currencyId?: number | null;
  currencyCode?: string | null;
  fxRate?: number;
  totalFunctional?: number | null;
}
