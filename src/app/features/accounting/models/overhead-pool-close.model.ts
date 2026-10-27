/** Body for `POST accounting/overhead/record`; no source account credits accrued expenses. */
export interface RecordOverheadInput {
  amount: number;
  memo: string | null;
  entryDate: string;
  sourceGlAccountId: number | null;
}

/** Outcome of `POST accounting/overhead/close`: the spending variance posted (positive is under-applied). */
export interface OverheadPoolCloseResult {
  actualOverhead: number;
  appliedOverhead: number;
  spendingVariance: number;
  posted: boolean;
}
