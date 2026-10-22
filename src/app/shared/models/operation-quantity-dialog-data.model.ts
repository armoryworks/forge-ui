import { OperationGate } from './operation-gate.model';
import { OperationReason } from './operation-reason.model';

export interface OperationQuantityDialogData {
  title: string;
  jobQuantity: number;
  completedQuantity: number;
  scrapQuantity: number;
  reasons: OperationReason[];
  touch?: boolean;
  decimalPlaces?: number | null;
  mode?: 'record' | 'stop';
  plannedQuantity?: number | null;
  gate?: OperationGate | null;
  initialQuantity?: number | null;
}
