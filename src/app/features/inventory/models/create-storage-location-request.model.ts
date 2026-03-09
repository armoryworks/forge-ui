import { LocationType } from './location-type.type';

export interface CreateStorageLocationRequest {
  name: string;
  locationType: LocationType;
  parentId?: number;
  barcode?: string;
  description?: string;
}
