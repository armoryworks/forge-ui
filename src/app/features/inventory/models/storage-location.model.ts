import { LocationType } from './location-type.type';

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
