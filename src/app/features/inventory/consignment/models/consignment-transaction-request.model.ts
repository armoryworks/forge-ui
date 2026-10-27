export interface ConsignmentTransactionRequest {
  quantity: number;
  notes: string | null;
  storageLocationId: number | null;
  binContentId: number | null;
  lotNumber: string | null;
  jobId: number | null;
  purchaseOrderId: number | null;
}
