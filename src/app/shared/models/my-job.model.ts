/** A row of the phone's "My work orders": an open job assigned to the caller. */
export interface MyJob {
  id: number;
  jobNumber: string;
  title: string;
  partNumber: string | null;
  quantity: number | null;
  dueDate: string | null;
  stageId: number;
  stageName: string;
  isOverdue: boolean;
  hasRunningTimer: boolean;
}
