/**
 * Rollup totals for a payment schedule, derived server-side at read time from
 * the live document total (SalesOrder.Total when linked, else Quote.Total).
 * remainingTotal = Σ non-waived milestone amounts − paidTotal.
 */
export interface PaymentScheduleTotals {
  documentTotal: number;
  paidTotal: number;
  remainingTotal: number;
}
