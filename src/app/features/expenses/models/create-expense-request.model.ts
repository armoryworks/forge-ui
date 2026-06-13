export interface CreateExpenseRequest {
  amount: number;
  category: string;
  description: string;
  jobId?: number;
  receiptFileId?: string;
  expenseDate: string;
  /** Vendor-settled: approval promotes the expense into a vendor bill (Accounts Payable). */
  vendorId?: number;
}
