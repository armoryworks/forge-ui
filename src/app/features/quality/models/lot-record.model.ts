export interface LotRecord {
  id: number;
  lotNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  jobId: number | null;
  jobNumber: string | null;
  productionRunId: number | null;
  purchaseOrderLineId: number | null;
  quantity: number;
  expirationDate: Date | null;
  supplierLotNumber: string | null;
  notes: string | null;
  createdAt: Date;
}
