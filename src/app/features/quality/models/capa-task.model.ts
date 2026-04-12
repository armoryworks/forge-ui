import { CapaTaskStatus } from './capa-task-status.model';

export interface CapaTask {
  id: number;
  capaId: number;
  title: string;
  description: string | null;
  assigneeId: number;
  assigneeName: string;
  dueDate: string;
  status: CapaTaskStatus;
  completedAt: string | null;
  completedById: number | null;
  completedByName: string | null;
  completionNotes: string | null;
  sortOrder: number;
}
