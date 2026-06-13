// ⚡ EDI BOUNDARY — outcome of a part-number-map CSV import.
export interface EdiPartNumberMapImportResult {
  imported: number;
  updated: number;
  skipped: number;
  unresolved: number;
  totalRows: number;
}
