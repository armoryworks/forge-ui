import { AssetType } from './asset-type.type';
import { AssetStatus } from './asset-status.type';

export interface AssetItem {
  id: number;
  name: string;
  assetType: AssetType;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  status: AssetStatus;
  photoFileId: string | null;
  currentHours: number;
  notes: string | null;
  isCustomerOwned: boolean;
  cavityCount: number | null;
  toolLifeExpectancy: number | null;
  currentShotCount: number | null;
  sourceJobNumber: string | null;
  sourcePartNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}
