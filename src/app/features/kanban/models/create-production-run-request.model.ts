export interface CreateProductionRunRequest {
  partId: number;
  targetQuantity: number;
  operatorId: number | null;
  notes: string | null;
  workCenterId: number | null;
  toolingAssetId: number | null;
}
