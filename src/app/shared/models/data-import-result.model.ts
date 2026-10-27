import { DataImportRowResult } from './data-import-row-result.model';

/** Result of validating or committing a CSV import; a commit writes every row or none. */
export interface DataImportResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  createdCount: number;
  committed: boolean;
  rows: DataImportRowResult[];
}
