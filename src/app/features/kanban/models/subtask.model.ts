export interface Subtask {
  id: number;
  jobId: number;
  text: string;
  isCompleted: boolean;
  assigneeId: number | null;
  sortOrder: number;
  completedAt: Date | null;
}
