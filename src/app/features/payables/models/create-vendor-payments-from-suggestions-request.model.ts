export interface CreateVendorPaymentsFromSuggestionsRequest {
  paymentDate: string;
  method: string;
  referenceNumber?: string;
  notes?: string;
  items: { vendorBillId: number; amount: number; discountAmount?: number }[];
}
