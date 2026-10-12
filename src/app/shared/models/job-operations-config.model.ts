import { OperationReason } from './operation-reason.model';

export interface JobOperationsConfig {
  operationTracking: boolean;
  reasons: OperationReason[];
}
