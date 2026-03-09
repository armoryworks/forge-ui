import { ExpenseStatus } from './expense-status.type';

export interface UpdateExpenseStatusRequest {
  status: ExpenseStatus;
  approvalNotes?: string;
}
