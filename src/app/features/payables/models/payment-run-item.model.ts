export interface PaymentRunItem {
  id: number;
  vendorBillId: number;
  billNumber: string | null;
  vendorId: number;
  vendorName: string;
  currencyId: number;
  currencyCode: string | null;
  amount: number;
  discountAmount: number | null;
  creditAmount: number;
  cashAmount: number;
  status: string;
  vendorPaymentId: number | null;
  paymentNumber: string | null;
  errorMessage: string | null;
  processedAt: string | null;
}
