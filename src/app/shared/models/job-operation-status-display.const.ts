import { JobOperationStatus } from './job-operation-status.type';

export const JOB_OPERATION_STATUS_DISPLAY: Record<JobOperationStatus, { labelKey: string; chipClass: string }> = {
  NotStarted: { labelKey: 'jobOperations.status.notStarted', chipClass: 'chip--muted' },
  InProgress: { labelKey: 'jobOperations.status.inProgress', chipClass: 'chip--info' },
  Complete: { labelKey: 'jobOperations.status.complete', chipClass: 'chip--success' },
  Skipped: { labelKey: 'jobOperations.status.skipped', chipClass: 'chip--warning' },
};
