import { AssetType } from './asset-type.type';
import { AssetStatus } from './asset-status.type';

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
}
