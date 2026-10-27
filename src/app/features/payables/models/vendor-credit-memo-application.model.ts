export interface VendorCreditMemoApplication {
  id: number;
  vendorCreditMemoId: number;
  memoNumber: string;
  vendorBillId: number;
  billNumber: string | null;
  amount: number;
  appliedAt: string;
  reversedAt: string | null;
  vendorPaymentId: number | null;
  paymentRunId: number | null;
}
