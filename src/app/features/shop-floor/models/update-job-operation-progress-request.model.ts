import { JobOperationStatus } from './job-operation-status.type';

export interface UpdateJobOperationProgressRequest {
  completedQuantity?: number | null;
  scrapQuantity?: number | null;
  reworkQuantity?: number | null;
  status?: JobOperationStatus | null;
  expectedVersion?: number | null;
  reasonCode?: string | null;
}
