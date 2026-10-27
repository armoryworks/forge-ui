export type DepreciationMethod = 'StraightLine' | 'UnitsOfProduction' | 'DecliningBalance';

export const DEPRECIATION_METHODS: readonly DepreciationMethod[] = ['StraightLine', 'DecliningBalance', 'UnitsOfProduction'];

export type FixedAssetStatus = 'Active' | 'FullyDepreciated' | 'Disposed';

/** A registered fixed asset with its derived depreciation figures (`GET accounting/fixed-assets`). */
export interface FixedAsset {
  id: number;
  bookId: number;
  name: string;
  assetTag: string | null;
  cost: number;
  salvageValue: number;
  inServiceDate: string;
  usefulLifeMonths: number;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  status: FixedAssetStatus;
  method: DepreciationMethod;
  linkedAssetId: number | null;
  usefulLifeUnits: number | null;
}
