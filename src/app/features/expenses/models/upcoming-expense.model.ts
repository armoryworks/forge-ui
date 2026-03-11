import { RecurrenceFrequency } from './recurrence-frequency.type';

export interface UpcomingExpense {
  recurringExpenseId: number;
  description: string;
  category: string;
  classification: string;
  vendor: string | null;
  amount: number;
  dueDate: string;
  frequency: RecurrenceFrequency;
  autoApprove: boolean;
}
