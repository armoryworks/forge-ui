export interface AdjustStockRequest {
  binContentId: number;
  newQuantity: number;
  reason: string;
  notes?: string;
}
