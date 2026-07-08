/**
 * One milestone of a quote/order pre-payment schedule (S2 read model).
 * `status` is the COMPUTED effective status (Pending is promoted to Due when
 * the trigger condition holds): Pending | Due | Invoiced | PartiallyPaid |
 * Paid | Waived. `amountDue` is derived server-side from percentage × live
 * document total (or the locked amount once invoiced).
 */
export interface PaymentMilestone {
  id: number;
  sequence: number;
  name: string;
  percentage: number;
  dueTrigger: string;
  dueDate: string | null;
  netDays: number | null;
  status: string;
  amountDue: number;
  paidAmount: number;
  invoiceId: number | null;
  notes: string | null;
}
