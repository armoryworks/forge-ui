// ⚡ ACCOUNTING BOUNDARY — AP counterpart of PaymentListItem.
export interface VendorPaymentListItem {
  id: number;
  paymentNumber: string;
  vendorId: number;
  vendorName: string;
  method: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  paymentDate: string;
  referenceNumber: string | null;
  createdAt: string;
  /** Latest bank transmission state — null when never transmitted (cash/check). */
  transmissionStatus: string | null;
  transmissionAttempts: number;
  transmissionId: number | null;
}
