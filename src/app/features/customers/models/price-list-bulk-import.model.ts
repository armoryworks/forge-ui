/**
 * Per-row outcome from the PriceListEntry CSV import preview / apply.
 * Matches the .NET `BulkImportRowAction` enum (string-serialized).
 */
export type BulkImportRowAction = 'Add' | 'Update' | 'Skip' | 'Error';

/**
 * One row from the dry-run preview. Mirrors the .NET
 * `BulkImportRowPreview` record.
 */
export interface BulkImportRowPreview {
  lineNumber: number;
  partNumber: string | null;
  partName: string | null;
  partId: number | null;
  unitPrice: number | null;
  minQuantity: number;
  currency: string;
  notes: string | null;
  action: BulkImportRowAction;
  errorMessage: string | null;
}

/**
 * Aggregate result of the dry-run preview endpoint
 * (`POST /api/v1/price-lists/{id}/entries/import-preview`). Pure read, no DB
 * mutation.
 */
export interface BulkImportPreviewResponse {
  totalRows: number;
  addCount: number;
  updateCount: number;
  errorCount: number;
  rows: BulkImportRowPreview[];
}

/**
 * Per-row outcome from the apply endpoint (post-commit). When the row
 * succeeded, `createdOrUpdatedEntryId` is populated.
 */
export interface BulkImportRowResult {
  lineNumber: number;
  action: BulkImportRowAction;
  createdOrUpdatedEntryId: number | null;
  errorMessage: string | null;
}

/**
 * Aggregate result of the apply endpoint
 * (`POST /api/v1/price-lists/{id}/entries/import-apply`). Returned after the
 * upsert transaction commits.
 */
export interface BulkImportResultResponse {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  rows: BulkImportRowResult[];
}
