/** One application table in the transfer summary (row count is the planner's estimate). */
export interface DumpTableInfo {
  schema: string;
  name: string;
  estimatedRows: number;
  sizeBytes: number;
}
