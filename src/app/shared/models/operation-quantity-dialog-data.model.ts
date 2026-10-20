import { OperationReason } from './operation-reason.model';

export interface OperationQuantityDialogData {
  title: string;
  jobQuantity: number;
  completedQuantity: number;
  scrapQuantity: number;
  reasons: OperationReason[];
  touch?: boolean;
}
