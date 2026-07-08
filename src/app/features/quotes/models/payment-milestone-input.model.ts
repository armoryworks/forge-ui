import { PaymentDueTrigger } from './payment-due-trigger.model';

/**
 * One milestone row in the PUT-style schedule upsert. Percentages are the
 * source of truth (Σ across the schedule must equal 100); amounts derive at
 * read time from the live document total. dueDate is only meaningful for
 * FixedDate, netDays only for NetDays.
 */
export interface PaymentMilestoneInput {
  name: string;
  percentage: number;
  dueTrigger: PaymentDueTrigger;
  dueDate?: string;
  netDays?: number;
  notes?: string;
}
