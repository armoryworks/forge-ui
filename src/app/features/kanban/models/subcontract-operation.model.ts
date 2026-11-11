export interface SubcontractOperation {
  operationId: number;
  stepNumber: number;
  title: string;
  vendorId: number;
  vendorName: string;
  subcontractCost: number | null;
  turnTimeDays: number | null;
  jobQuantity: number;
  committedQuantity?: number;
  remainingQuantity?: number;
  maxSendQuantity?: number | null;
}
