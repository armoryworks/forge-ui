import { Stage } from '../../../shared/models/stage.model';
import { KanbanJob } from './kanban-job.model';

export interface BoardColumn {
  stage: Stage;
  jobs: KanbanJob[];
}
