export interface TrackType {
  id: number;
  name: string;
  code: string;
  description: string | null;
  isDefault: boolean;
  sortOrder: number;
  stages: Stage[];
}

export interface Stage {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  accountingDocumentType: string | null;
  isIrreversible: boolean;
}

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
}

export interface BoardColumn {
  stage: Stage;
  jobs: KanbanJob[];
}

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
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: number;
  jobId: number;
  text: string;
  isCompleted: boolean;
  assigneeId: number | null;
  sortOrder: number;
  completedAt: string | null;
}

export interface Activity {
  id: number;
  action: string;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string;
  userInitials: string | null;
  userName: string | null;
  createdAt: string;
}

export interface CustomerRef {
  id: number;
  name: string;
}

export interface UserRef {
  id: number;
  initials: string;
  name: string;
  color: string;
}

export const PRIORITY_COLORS: Record<string, string> = {
  Low: '#94a3b8',
  Normal: '#0d9488',
  High: '#f59e0b',
  Urgent: '#dc2626',
};
