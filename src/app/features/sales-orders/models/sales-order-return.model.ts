export interface SalesOrderReturn {
  id: number;
  returnNumber: string;
  status: string;
  reason: string | null;
  returnDate: Date | null;
  originalJobId: number | null;
  originalJobNumber: string | null;
  reworkJobId: number | null;
  reworkJobNumber: string | null;
  inspectionNotes: string | null;
}
