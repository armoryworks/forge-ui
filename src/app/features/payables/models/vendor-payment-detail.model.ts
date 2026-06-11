import { VendorPaymentApplication } from './vendor-payment-application.model';

// ⚡ ACCOUNTING BOUNDARY — full detail projection of a vendor payment: the
// list shape plus the per-bill application breakdown.
export interface VendorPaymentDetail {
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
  notes: string | null;
  createdAt: string;
  applications: VendorPaymentApplication[];
}
