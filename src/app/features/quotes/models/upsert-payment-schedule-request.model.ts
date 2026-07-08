import { PaymentMilestoneInput } from './payment-milestone-input.model';

/**
 * PUT body for the bulk-replace payment-schedule upsert on a quote.
 * Server rejects (409) when any existing milestone is Invoiced /
 * PartiallyPaid / Paid, when Σ percentage ≠ 100, or when > 20 rows.
 */
export interface UpsertPaymentScheduleRequest {
  milestones: PaymentMilestoneInput[];
}
