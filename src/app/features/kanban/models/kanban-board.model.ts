import { BoardColumn } from './board-column.model';

export interface KanbanBoard {
  columns: BoardColumn[];
  totalCount: number;
  loadedCount: number;
}
