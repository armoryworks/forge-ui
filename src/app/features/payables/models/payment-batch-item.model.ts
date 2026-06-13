// ⚡ BANKING BOUNDARY — one NACHA entry line (masked account display only).
export interface PaymentBatchItem {
  id: number;
  vendorPaymentId: number | null;
  paymentNumber: string | null;
  vendorId: number;
  vendorName: string;
  accountNumberMasked: string;
  amount: number;
  traceNumber: string | null;
}
