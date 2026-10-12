export interface OperationQuantityDialogResult {
  completedQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  reasonCode: string | null;
  complete: boolean;
}
