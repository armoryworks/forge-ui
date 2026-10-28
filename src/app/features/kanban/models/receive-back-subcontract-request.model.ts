export interface ReceiveBackSubcontractRequest {
  receivedQuantity: number;
  scrapQuantity: number;
  passedInspection: boolean;
  confirmOverTolerance?: boolean;
  overToleranceReason?: string;
  closeShort?: boolean;
}
