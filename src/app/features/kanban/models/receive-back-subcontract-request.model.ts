export interface ReceiveBackSubcontractRequest {
  receivedQuantity: number;
  rejectedQuantity: number;
  scrapQuantity: number;
  confirmOverTolerance?: boolean;
  overToleranceReason?: string;
  closeShort?: boolean;
}
