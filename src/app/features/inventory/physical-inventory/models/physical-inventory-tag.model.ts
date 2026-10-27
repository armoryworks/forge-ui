import { PhysicalInventoryTagStatus } from './physical-inventory-tag-status.type';

export interface PhysicalInventoryTag {
  id: number;
  physicalInventoryId: number;
  tagNumber: number;
  locationId: number;
  locationName: string;
  locationBarcode: string | null;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  lotNumber: string | null;
  serialNumber: string | null;
  frozenQuantity: number | null;
  countedQuantity: number | null;
  recountQuantity: number | null;
  finalQuantity: number | null;
  status: PhysicalInventoryTagStatus;
  countedAt: string | null;
  recountedAt: string | null;
  notes: string | null;
}
