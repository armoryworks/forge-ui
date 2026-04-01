import { ExpenseStatus } from './expense-status.type';

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
  expenseDate: Date;
  createdAt: Date;
}
