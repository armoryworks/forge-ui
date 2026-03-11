import { RecurrenceFrequency } from './recurrence-frequency.type';

export interface CreateRecurringExpenseRequest {
  amount: number;
  category: string;
  classification: string;
  description: string;
  vendor?: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  autoApprove: boolean;
}
