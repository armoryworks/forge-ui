/** C2: per-row classification returned by the customer bulk-intake preview/commit. */
export type BulkCustomerIntakeRowStatus =
  | 'Created'
  | 'Invalid'
  | 'DuplicateWithinBatch'
  | 'DuplicateExistingCustomer';

/** A parsed customer row submitted to the bulk-intake preview/commit. */
export interface BulkCustomerIntakeRow {
  externalRowKey: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

/** Per-row result — points at the created or matched (duplicate) customer. */
export interface BulkCustomerIntakeRowResult {
  externalRowKey: string | null;
  status: BulkCustomerIntakeRowStatus;
  createdCustomerId: number | null;
  matchedCustomerId: number | null;
  message: string | null;
}

/** Preview/commit response — counts + per-row results. */
export interface BulkCustomerIntakeResponse {
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  results: BulkCustomerIntakeRowResult[];
}

/** Preview/commit request payload. */
export interface BulkCustomerIntakeRequest {
  rows: BulkCustomerIntakeRow[];
}
