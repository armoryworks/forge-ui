/** One asset's charge in a depreciation preview. */
export interface DepreciationPreviewLine {
  fixedAssetId: number;
  name: string;
  assetTag: string | null;
  amount: number;
  netBookValueAfter: number;
}

/** What `POST accounting/depreciation/run` would post for a month (`POST accounting/depreciation/preview`). */
export interface DepreciationPreview {
  bookId: number;
  periodMonth: string;
  lines: DepreciationPreviewLine[];
  totalAmount: number;
}
