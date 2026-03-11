export interface KanbanJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  assigneeInitials: string | null;
  assigneeColor: string | null;
  priorityName: string;
  dueDate: string | null;
  isOverdue: boolean;
  customerName: string | null;
  billingStatus: string | null;
  externalRef: string | null;
  accountingDocumentType: string | null;
  disposition: string | null;
  childJobCount: number;
}
