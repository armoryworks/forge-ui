export interface ReceiveLineRequest {
  lineId: number;
  quantity: number;
  storageLocationId?: number;
  notes?: string;
}
