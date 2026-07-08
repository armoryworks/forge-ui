/**
 * POST body for recording a (possibly partial) payment against a milestone.
 * Payments accumulate; the milestone flips to Paid once Σ paid covers the
 * derived (or locked) amount.
 */
export interface MarkMilestonePaidRequest {
  paidAmount: number;
  paidReference?: string;
}
