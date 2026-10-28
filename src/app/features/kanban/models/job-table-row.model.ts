import { KanbanJob } from './kanban-job.model';

export interface JobTableRow extends KanbanJob {
  onHold: boolean;
  operationsProgress: number | null;
}
