import { JobOperationStatus } from '../../../shared/models/job-operation-status.type';

export interface OperationProgressSnapshot {
  status: JobOperationStatus;
  completedQuantity: number;
  scrapQuantity: number;
}
