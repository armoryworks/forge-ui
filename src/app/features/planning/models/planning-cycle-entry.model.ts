export interface PlanningCycleEntry {
  id: number;
  jobId: number;
  jobNumber: string;
  jobTitle: string;
  assigneeName: string | null;
  stageName: string;
  stageColor: string | null;
  priority: string;
  isRolledOver: boolean;
  committedAt: string;
  completedAt: string | null;
  sortOrder: number;
}
