export interface WorkCenter {
  id: number;
  name: string;
  code: string;
  description: string | null;
  dailyCapacityHours: number;
  efficiencyPercent: number;
  numberOfMachines: number;
  laborCostPerHour: number;
  burdenRatePerHour: number;
  isActive: boolean;
  assetId: number | null;
  assetName: string | null;
  companyLocationId: number | null;
  locationName: string | null;
  sortOrder: number;
}

export interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  netHours: number;
  isActive: boolean;
}

export interface ScheduledOperation {
  id: number;
  jobId: number;
  jobNumber: string;
  jobTitle: string | null;
  operationId: number;
  operationTitle: string;
  workCenterId: number;
  workCenterName: string;
  scheduledStart: string;
  scheduledEnd: string;
  setupHours: number;
  runHours: number;
  totalHours: number;
  status: 'Scheduled' | 'InProgress' | 'Complete' | 'Cancelled';
  sequenceNumber: number;
  isLocked: boolean;
  jobPriority: string | null;
  jobDueDate: string | null;
  color: string | null;
}

export interface ScheduleRun {
  id: number;
  runDate: string;
  direction: 'Forward' | 'Backward';
  status: 'Queued' | 'Running' | 'Completed' | 'Failed';
  operationsScheduled: number;
  conflictsDetected: number;
  completedAt: string | null;
  runByUserId: number;
  errorMessage: string | null;
}

export interface WorkCenterLoad {
  workCenterId: number;
  workCenterName: string;
  buckets: WorkCenterLoadBucket[];
}

export interface WorkCenterLoadBucket {
  weekStart: string;
  capacityHours: number;
  scheduledHours: number;
  utilizationPercent: number;
}

export interface DispatchListItem {
  scheduledOperationId: number;
  jobId: number;
  jobNumber: string;
  operationId: number;
  operationTitle: string;
  sequenceNumber: number;
  scheduledStart: string;
  setupHours: number;
  runHours: number;
  priority: string | null;
  jobDueDate: string | null;
}

export interface RunSchedulerRequest {
  direction: 'Forward' | 'Backward';
  scheduleFrom: string;
  scheduleTo: string;
  jobIdFilter?: number[];
  priorityRule: string;
}

export interface CreateWorkCenterRequest {
  name: string;
  code: string;
  description: string | null;
  dailyCapacityHours: number;
  efficiencyPercent: number;
  numberOfMachines: number;
  laborCostPerHour: number;
  burdenRatePerHour: number;
  assetId: number | null;
  companyLocationId: number | null;
  sortOrder: number;
}

export interface CreateShiftRequest {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}
