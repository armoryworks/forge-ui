import { OperationReason } from '../../../shared/models/operation-reason.model';

export interface KioskStepContext {
  jobQuantity: number;
  decimalPlaces: number | null;
  reasons: OperationReason[];
}
