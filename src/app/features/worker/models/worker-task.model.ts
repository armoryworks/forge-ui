export interface WorkerTask {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priority: string;
  customerName: string | null;
  dueDate: Date | null;
  subtaskCount: number;
  subtasksCompleted: number;
}
