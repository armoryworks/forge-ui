import { LocationType } from './location-type.type';

export interface StorageLocationFlat {
  id: number;
  name: string;
  locationType: LocationType;
  barcode: string | null;
  locationPath: string;
}
