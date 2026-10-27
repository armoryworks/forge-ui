import { FixedAsset } from './fixed-asset.model';

/** One month of a fixed asset's schedule: posted (with its journal entry) or projected. */
export interface DepreciationScheduleRow {
  periodMonth: string;
  amount: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  posted: boolean;
  journalEntryId: number | null;
}

/** A fixed asset with its GL accounts and its schedule (`GET accounting/fixed-assets/{id}`). */
export interface FixedAssetDetail {
  asset: FixedAsset;
  assetGlAccountId: number;
  accumulatedDepreciationGlAccountId: number;
  depreciationExpenseGlAccountId: number;
  isEditable: boolean;
  schedule: DepreciationScheduleRow[];
}
