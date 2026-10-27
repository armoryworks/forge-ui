export interface AddPhysicalInventoryTagRequest {
  locationId: number;
  partId: number;
  lotNumber: string | null;
  serialNumber: string | null;
  quantity: number | null;
  notes: string | null;
}
