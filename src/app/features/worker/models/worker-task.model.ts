export interface WorkerTask {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priority: string;
  customerName: string | null;
  dueDate: string | null;
  subtaskCount: number;
  subtasksCompleted: number;
}
