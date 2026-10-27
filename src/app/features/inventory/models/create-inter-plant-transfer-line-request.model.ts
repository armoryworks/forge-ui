export interface CreateInterPlantTransferLineRequest {
  partId: number;
  quantity: number;
  fromLocationId: number | null;
  toLocationId: number | null;
  lotNumber: string | null;
}
