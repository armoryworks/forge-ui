/** One open bill the payment run suggests paying, with the discount it earns if paid on the pay date. */
export interface VendorPaymentSuggestion {
  vendorBillId: number;
  billNumber: string;
  vendorId: number;
  vendorName: string;
  vendorInvoiceNumber: string | null;
  currencyId: number;
  currencyCode: string | null;
  billDate: string;
  dueDate: string;
  balanceDue: number;
  suggestedPayAmount: number;
  suggestedDiscount: number;
  discountDeadline: string | null;
  daysLeft: number | null;
  paymentTermsName: string | null;
  /** What the vendor's open credit memos in the bill's currency could deduct. */
  vendorOpenCredit?: number;
}
