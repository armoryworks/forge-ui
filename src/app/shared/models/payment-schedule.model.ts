import { PaymentMilestone } from './payment-milestone.model';
import { PaymentScheduleTotals } from './payment-schedule-totals.model';

/**
 * Quote/order pre-payment schedule (S2). Authored on the quote and re-linked
 * (salesOrderId set) at conversion — the same row is visible from both
 * documents, never cloned. Lives in shared/models because the schedule is
 * rendered by the shared PaymentProgressComponent from both the quote and
 * (later) the sales-order detail panels.
 */
export interface PaymentSchedule {
  id: number;
  quoteId: number | null;
  salesOrderId: number | null;
  status: string;
  milestones: PaymentMilestone[];
  totals: PaymentScheduleTotals;
}
