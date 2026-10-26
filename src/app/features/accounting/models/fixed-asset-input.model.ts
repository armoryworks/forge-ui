import { DepreciationMethod } from './fixed-asset.model';

/** Register (`POST accounting/fixed-assets`, with `bookId`) or edit (`PUT accounting/fixed-assets/{id}`) a fixed asset. */
export interface FixedAssetInput {
  bookId?: number;
  name: string;
  assetTag: string | null;
  cost: number;
  salvageValue: number;
  inServiceDate: string;
  usefulLifeMonths: number;
  assetGlAccountId: number;
  accumulatedDepreciationGlAccountId: number;
  depreciationExpenseGlAccountId: number;
  method: DepreciationMethod;
  usefulLifeUnits: number | null;
  linkedAssetId: number | null;
}
