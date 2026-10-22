import { AssetType } from './asset-type.type';
import { AssetStatus } from './asset-status.type';
import { DepreciationMethod } from './create-asset-request.model';

export interface UpdateAssetRequest {
  name?: string;
  assetType?: AssetType;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status?: AssetStatus;
  currentHours?: number;
  notes?: string;
  isCustomerOwned?: boolean;
  cavityCount?: number;
  toolLifeExpectancy?: number;
  currentShotCount?: number;
  acquisitionCost?: number;
  depreciationMethod?: DepreciationMethod;
  workCenterId?: number;
  glAccount?: string;
}
