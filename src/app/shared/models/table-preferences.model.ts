import { SortState } from './sort-state.model';

export interface TablePreferences {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, string>;
  sortState: SortState[];
  pageSize: number;
  filters: Record<string, unknown>;
}
