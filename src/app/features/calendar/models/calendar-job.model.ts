export interface CalendarJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  assigneeInitials: string | null;
  assigneeColor: string | null;
  priorityName: string;
  dueDate: Date | null;
  isOverdue: boolean;
  customerName: string | null;
  trackTypeId: number;
  trackTypeColor: string | null;
}
