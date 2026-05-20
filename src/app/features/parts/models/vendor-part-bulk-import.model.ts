/**
 * Per-row outcome from the VendorPart CSV import preview / apply.
 * Matches the .NET `BulkImportRowAction` enum (string-serialized).
 */
export type VendorPartImportRowAction = 'Add' | 'Update' | 'Skip' | 'Error';

/**
 * One row from the dry-run preview. Mirrors the .NET
 * `VendorPartImportRowPreview` record.
 */
export interface VendorPartImportRowPreview {
  lineNumber: number;
  partNumber: string | null;
  partName: string | null;
  partId: number | null;
  vendorPartNumber: string | null;
  manufacturerName: string | null;
  vendorMpn: string | null;
  leadTimeDays: number | null;
  minOrderQty: number | null;
  packSize: number | null;
  countryOfOrigin: string | null;
  htsCode: string | null;
  notes: string | null;
  action: VendorPartImportRowAction;
  errorMessage: string | null;
}

/**
 * Aggregate result of the dry-run preview endpoint
 * (`POST /api/v1/vendors/{vendorId}/vendor-parts/import-preview`). Pure read.
 */
export interface VendorPartImportPreviewResponse {
  totalRows: number;
  addCount: number;
  updateCount: number;
  errorCount: number;
  rows: VendorPartImportRowPreview[];
}

/**
 * Per-row outcome from the apply endpoint (post-commit). When the row
 * succeeded, `vendorPartId` is populated.
 */
export interface VendorPartImportRowResult {
  lineNumber: number;
  action: VendorPartImportRowAction;
  vendorPartId: number | null;
  errorMessage: string | null;
}

/**
 * Aggregate result of the apply endpoint
 * (`POST /api/v1/vendors/{vendorId}/vendor-parts/import-apply`).
 */
export interface VendorPartImportResultResponse {
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  rows: VendorPartImportRowResult[];
}
