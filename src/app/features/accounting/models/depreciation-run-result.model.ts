/** Outcome of `POST accounting/depreciation/run`: one journal entry per asset depreciated. */
export interface DepreciationRunResult {
  bookId: number;
  periodMonth: string;
  assetsDepreciated: number;
  totalAmount: number;
  journalEntryIds: number[] | null;
}
