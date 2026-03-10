export interface TransferStockRequest {
  sourceBinContentId: number;
  destinationLocationId: number;
  quantity: number;
  notes?: string;
}
