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
  /** Latest bank transmission state — all null/0 for non-electronic payments. */
  transmissionId: number | null;
  transmissionStatus: string | null;
  transmissionAttempts: number;
  transmissionLastError: string | null;
  transmissionSubmissionRef: string | null;
  transmissionNextAttemptAt: string | null;
}
