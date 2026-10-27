export interface ReceiveTransferLineRequest {
  partId: number;
  receivedQuantity: number;
  toLocationId: number | null;
  lineId: number;
}
