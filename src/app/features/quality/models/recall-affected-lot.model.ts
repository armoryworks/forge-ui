export interface RecallAffectedLot {
  lotId: number;
  lotNumber: string;
  partNumber: string;
  consumedQuantity: number;
  jobId: number | null;
  onHandQuantity: number;
  quarantinedQuantity: number;
}
