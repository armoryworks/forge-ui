import { AssetType } from './asset-type.type';

export type DepreciationMethod = 'StraightLine' | 'DecliningBalance' | 'UnitsOfProduction';

/**
 * Asset-create payload. Phase 3 F4 extends with acquisitionCost,
 * depreciationMethod, workCenterId, glAccount so the small-shop onboarding
 * form does not need a PATCH-after-create round trip.
 */
export interface CreateAssetRequest {
  name: string;
  assetType: AssetType;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  notes?: string;
  isCustomerOwned?: boolean;
  cavityCount?: number;
  toolLifeExpectancy?: number;
  // F4 — full-record fields
  acquisitionCost?: number;
  depreciationMethod?: DepreciationMethod;
  workCenterId?: number;
  glAccount?: string;
}
