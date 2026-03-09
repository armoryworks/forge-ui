export interface BulkResult {
  successCount: number;
  failureCount: number;
  errors: { jobId: number; message: string }[];
}
