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

export const PRIORITY_COLORS: Record<string, string> = {
  Low: '#94a3b8',
  Normal: '#0d9488',
  High: '#f59e0b',
  Urgent: '#dc2626',
};
