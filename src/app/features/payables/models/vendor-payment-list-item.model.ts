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
}
