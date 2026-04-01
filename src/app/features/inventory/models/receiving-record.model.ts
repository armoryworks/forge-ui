export interface ReceivingRecord {
  id: number;
  purchaseOrderLineId: number;
  purchaseOrderNumber: string | null;
  partId: number | null;
  partNumber: string | null;
  quantityReceived: number;
  receivedBy: string | null;
  storageLocationId: number | null;
  storageLocationName: string | null;
  lotNumber: string | null;
  notes: string | null;
  createdAt: Date;
}
