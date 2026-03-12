import { KanbanJob } from './kanban-job.model';
import { UserRef } from './user-ref.model';

export interface SwimlaneCellData {
  jobs: KanbanJob[];
}

export interface SwimlaneRow {
  user: UserRef | null; // null = Unassigned
  cells: SwimlaneCellData[]; // one per stage, same order as columns
}
