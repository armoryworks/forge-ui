export interface StorageLocation {
  id: number;
  name: string;
  locationType: LocationType;
  parentId: number | null;
  barcode: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  locationPath: string;
  contentCount: number;
  children: StorageLocation[];
}

export interface StorageLocationFlat {
  id: number;
  name: string;
  locationType: LocationType;
  barcode: string | null;
  locationPath: string;
}

export interface BinContentItem {
  id: number;
  locationId: number;
  locationName: string;
  locationPath: string;
  entityType: string;
  entityId: number;
  entityName: string;
  quantity: number;
  lotNumber: string | null;
  jobId: number | null;
  jobNumber: string | null;
  status: BinContentStatus;
  placedAt: string;
}

export interface BinMovementItem {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  quantity: number;
  lotNumber: string | null;
  fromLocationId: number | null;
  fromLocationName: string | null;
  toLocationId: number | null;
  toLocationName: string | null;
  movedByName: string;
  movedAt: string;
  reason: BinMovementReason | null;
}

export interface InventoryPartSummary {
  partId: number;
  partNumber: string;
  description: string;
  material: string | null;
  onHand: number;
  reserved: number;
  available: number;
  binLocations: BinStock[];
}

export interface BinStock {
  locationId: number;
  locationName: string;
  locationPath: string;
  quantity: number;
  status: BinContentStatus;
  lotNumber: string | null;
}

export interface CreateStorageLocationRequest {
  name: string;
  locationType: LocationType;
  parentId?: number;
  barcode?: string;
  description?: string;
}

export interface PlaceBinContentRequest {
  locationId: number;
  entityType: string;
  entityId: number;
  quantity: number;
  lotNumber?: string;
  jobId?: number;
  status: BinContentStatus;
  notes?: string;
}

export type LocationType = 'Area' | 'Rack' | 'Shelf' | 'Bin';
export type BinContentStatus = 'Stored' | 'Reserved' | 'ReadyToShip' | 'QcHold';
export type BinMovementReason = 'Receive' | 'Pick' | 'Restock' | 'QcRelease' | 'Ship' | 'Move' | 'Adjustment' | 'Return';
