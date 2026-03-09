export interface TablePreferences {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnWidths: Record<string, string>;
  sortState: SortState[];
  pageSize: number;
  filters: Record<string, unknown>;
}

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}
