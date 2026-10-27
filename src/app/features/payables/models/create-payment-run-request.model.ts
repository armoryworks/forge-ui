export interface CreatePaymentRunRequest {
  paymentDate: string;
  method: string;
  referenceNumber?: string | null;
  notes?: string | null;
  applyVendorCredits: boolean;
  items: { vendorBillId: number; amount: number; discountAmount?: number }[];
}
