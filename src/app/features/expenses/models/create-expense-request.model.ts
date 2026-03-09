export interface CreateExpenseRequest {
  amount: number;
  category: string;
  description: string;
  jobId?: number;
  receiptFileId?: string;
  expenseDate: string;
}
