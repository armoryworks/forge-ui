/** One row's outcome in a CSV import: `Valid` (dry run), `Created` (committed) or `Invalid` (see errors). */
export interface DataImportRowResult {
  rowKey: string | null;
  rowNumber: number;
  status: 'Valid' | 'Created' | 'Invalid';
  errors: string[];
  number: string | null;
  createdId: number | null;
}
