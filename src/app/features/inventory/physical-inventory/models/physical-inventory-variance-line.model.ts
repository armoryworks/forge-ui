export interface PhysicalInventoryVarianceLine {
  tagId: number;
  tagNumber: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  locationName: string;
  lotNumber: string | null;
  frozenQuantity: number;
  countedQuantity: number;
  varianceQuantity: number;
  variancePercent: number | null;
  unitCost: number;
  varianceValue: number;
  recounted: boolean;
}
