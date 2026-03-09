export interface ExpenseItem {
  id: number;
  userId: number;
  userName: string;
  jobId: number | null;
  jobNumber: string | null;
  amount: number;
  category: string;
  description: string;
  receiptFileId: string | null;
  status: ExpenseStatus;
  approvedBy: number | null;
  approvedByName: string | null;
  approvalNotes: string | null;
  expenseDate: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  amount: number;
  category: string;
  description: string;
  jobId?: number;
  receiptFileId?: string;
  expenseDate: string;
}

export interface UpdateExpenseStatusRequest {
  status: ExpenseStatus;
  approvalNotes?: string;
}

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected' | 'SelfApproved';
