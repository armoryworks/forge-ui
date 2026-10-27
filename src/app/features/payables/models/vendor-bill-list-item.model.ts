// ⚡ ACCOUNTING BOUNDARY — AP counterpart of InvoiceListItem.
export interface VendorBillListItem {
  id: number;
  billNumber: string;
  vendorId: number;
  vendorName: string;
  vendorInvoiceNumber: string | null;
  status: string;
  billDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  /** True when any payment applied to this bill has a failed latest bank transmission. */
  hasFailedTransmission: boolean;
  /** Set when the bill was auto-promoted from a vendor-settled expense approval. */
  sourceExpenseId: number | null;
  currencyId?: number | null;
  currencyCode?: string | null;
  fxRate?: number;
  totalFunctional?: number | null;
  paymentTermsId?: number | null;
  /** Early-payment discount in percent (2 = 2 %); 0 when the bill's terms carry none. */
  discountPercent?: number;
  discountDueDate?: string | null;
  /** The last day a payment still takes the discount (the discount date plus any grace days). */
  discountDeadline?: string | null;
  discountsTaken?: number;
  /** The discount still available, ignoring the date. */
  discountAvailable?: number;
  /** Vendor credit memo amounts applied to the bill. */
  creditsApplied?: number;
}
