import { CreateVendorPaymentApplicationRequest } from './create-vendor-payment-application-request.model';

// ⚡ ACCOUNTING BOUNDARY — request to create a vendor payment. Creating a
// vendor payment IS the cash-disbursement posting trigger (when FULLGL is on).
export interface CreateVendorPaymentRequest {
  vendorId: number;
  method: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  applications?: CreateVendorPaymentApplicationRequest[];
}
