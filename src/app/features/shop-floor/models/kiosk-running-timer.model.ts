export interface KioskRunningTimer {
  timeEntryId: number;
  jobId: number | null;
  jobNumber: string | null;
  jobOperationId: number | null;
  operationId: number | null;
  stepNumber: number | null;
  operationTitle: string | null;
  entryType: string;
  timerStart: string;
  attendancePercent: number;
  cycleMinutes?: number | null;
}
