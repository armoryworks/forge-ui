export interface LaborReconciliationRow {
  userId: number;
  userName: string;
  date: string;
  paidMinutes: number | null;
  jobLaborMinutes: number;
  indirectMinutes: number;
  manualMinutes: number;
  unallocatedMinutes: number | null;
  overlappingTimerMinutes: number;
  longTimers: number;
  runningTimers: number;
}
