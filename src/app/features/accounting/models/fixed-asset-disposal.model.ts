import { FixedAsset } from './fixed-asset.model';

/** Body for `POST accounting/fixed-assets/{id}/dispose`. */
export interface DisposeFixedAssetInput {
  disposalDate: string;
  proceeds: number;
  proceedsGlAccountId: number | null;
  gainLossGlAccountId: number | null;
  memo: string | null;
}

/** Outcome of a disposal: catch-up depreciation, book value written off and the gain (positive) or loss. */
export interface FixedAssetDisposalResult {
  asset: FixedAsset;
  journalEntryId: number | null;
  catchUpDepreciation: number;
  netBookValue: number;
  proceeds: number;
  gainLoss: number;
}

/** What a disposal on a date would post (`POST accounting/fixed-assets/{id}/dispose/preview`), posting nothing. */
export interface FixedAssetDisposalPreview {
  fixedAssetId: number;
  disposalDate: string;
  catchUpDepreciation: number;
  netBookValue: number;
  proceeds: number;
  gainLoss: number;
}
