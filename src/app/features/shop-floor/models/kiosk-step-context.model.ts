import { OperationReason } from '../../../shared/models/operation-reason.model';
import { StepGatingMode } from '../../../shared/models/step-gating-mode.type';

export interface KioskStepContext {
  jobQuantity: number;
  decimalPlaces: number | null;
  reasons: OperationReason[];
  gating?: StepGatingMode | null;
}
