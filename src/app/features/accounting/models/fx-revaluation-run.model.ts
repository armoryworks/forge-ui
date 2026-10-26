/** A posted unrealized revaluation entry (`GET accounting/fx-revaluations`). */
export interface FxRevaluationRun {
  journalEntryId: number;
  entryNumber: number;
  asOf: string;
  currencyId: number;
  currencyCode: string | null;
  adjustment: number;
  memo: string | null;
  reversed: boolean;
  postedAt: string | null;
}
