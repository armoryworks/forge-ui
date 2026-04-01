import { RecurrenceFrequency } from './recurrence-frequency.type';

export interface RecurringExpense {
  id: number;
  userId: number;
  userName: string;
  amount: number;
  category: string;
  classification: string;
  description: string;
  vendor: string | null;
  frequency: RecurrenceFrequency;
  nextOccurrenceDate: Date;
  lastGeneratedDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  autoApprove: boolean;
  createdAt: Date;
}
