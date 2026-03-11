import { AssetType } from './asset-type.type';

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
}
