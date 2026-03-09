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
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequest {
  name: string;
  assetType: AssetType;
  location?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  notes?: string;
}

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
}

export type AssetType = 'Machine' | 'Tooling' | 'Facility' | 'Vehicle' | 'Other';
export type AssetStatus = 'Active' | 'Maintenance' | 'Retired' | 'OutOfService';
