import { OperationReason } from '../../../shared/models/operation-reason.model';

export interface JobOperationsConfig {
  operationTracking: boolean;
  reasons?: OperationReason[];
}
