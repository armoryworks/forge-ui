export interface MyWorkHistoryItem {
  jobId: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string | null;
  customerName: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
}
