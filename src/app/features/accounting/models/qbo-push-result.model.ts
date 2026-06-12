/** QB-001 push outcome: the QuickBooks doc id plus the balanced JE's shape. */
export interface QboPushResult {
  qboDocId: string;
  fromDate: string;
  toDate: string;
  totalDebit: number;
  lineCount: number;
}
