/** Per-row classification returned by the part bulk-intake preview/commit. */
export type BulkPartIntakeRowStatus =
  | 'Created'
  | 'Invalid'
  | 'DuplicateWithinBatch'
  | 'DuplicateExistingPart';

/** A parsed part row submitted to the bulk-intake preview/commit. ProcurementSource /
 *  inventoryClass are free text (parsed leniently server-side); externalId carries the
 *  author's own/legacy part number (Forge issues its own number on commit). */
export interface BulkPartIntakeRow {
  externalRowKey: string;
  name: string;
  description?: string;
  procurementSource?: string;
  inventoryClass?: string;
  externalId?: string;
}

/** Per-row result — createdPartNumber is the server-issued number on commit; matchedPartId
 *  points at the existing part for a duplicate. */
export interface BulkPartIntakeRowResult {
  externalRowKey: string | null;
  status: BulkPartIntakeRowStatus;
  createdPartId: number | null;
  createdPartNumber: string | null;
  matchedPartId: number | null;
  message: string | null;
}

/** Preview/commit response — counts + per-row results. */
export interface BulkPartIntakeResponse {
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  results: BulkPartIntakeRowResult[];
}

/** Preview/commit request payload. */
export interface BulkPartIntakeRequest {
  rows: BulkPartIntakeRow[];
}
