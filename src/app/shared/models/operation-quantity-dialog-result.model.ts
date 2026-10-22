export interface OperationQuantityDialogResult {
  completedQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  reasonCode: string | null;
  complete: boolean;
  addedQuantity: number;
  addedScrap: number;
  skipped?: boolean;
}
