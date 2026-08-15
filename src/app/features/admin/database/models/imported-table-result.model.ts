/** One table loaded by an import; droppedColumns are dumped columns the current schema no longer has. */
export interface ImportedTableResult {
  qualified: string;
  rows: number;
  droppedColumns: string[];
}
