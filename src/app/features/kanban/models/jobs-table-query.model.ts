import { BoardFilters } from './board-filters.model';

export interface JobsTableQuery {
  trackTypeId: number | null;
  filters: BoardFilters;
  includeArchived: boolean;
  assigneeIds: number[];
  myWorkUserId: number | null;
}
