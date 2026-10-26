/**
 * One currency's unrealized revaluation (`POST accounting/fx-revaluation[/all]`): the open foreign position,
 * its functional carrying value, the rate used and the adjustment (positive = gain). `journalEntryId` is null
 * for a preview or when nothing needed to post.
 */
export interface FxRevaluationResult {
  bookId: number;
  currencyId: number;
  currencyCode: string | null;
  asOf: string;
  netForeignPosition: number;
  carryingFunctional: number;
  rate: number;
  adjustment: number;
  journalEntryId: number | null;
}
