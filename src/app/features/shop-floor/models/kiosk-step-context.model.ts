import { OperationReason } from '../../../shared/models/operation-reason.model';
import { StepGatingMode } from '../../../shared/models/step-gating-mode.type';

export interface KioskStepContext {
  jobQuantity: number;
  targetQuantity?: number | null;
  decimalPlaces: number | null;
  reasons: OperationReason[];
  gating?: StepGatingMode | null;
}
