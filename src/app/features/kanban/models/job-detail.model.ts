export interface JobDetail {
  id: number;
  jobNumber: string;
  title: string;
  description: string | null;
  trackTypeId: number;
  trackTypeName: string;
  currentStageId: number;
  stageName: string;
  stageColor: string;
  assigneeId: number | null;
  assigneeInitials: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  priority: string;
  customerId: number | null;
  customerName: string | null;
  dueDate: string | null;
  startDate: string | null;
  completedDate: string | null;
  isArchived: boolean;
  boardPosition: number;
  iterationCount: number;
  iterationNotes: string | null;
  createdAt: string;
  updatedAt: string;
}
