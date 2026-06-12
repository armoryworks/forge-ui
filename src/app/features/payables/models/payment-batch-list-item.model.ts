// ⚡ BANKING BOUNDARY — list projection of a NACHA payment batch.
export interface PaymentBatchListItem {
  id: number;
  batchNumber: string;
  status: string;
  isPrenote: boolean;
  effectiveEntryDate: string;
  totalAmount: number;
  entryCount: number;
  createdByUserId: number;
  createdByName: string;
  releasedByUserId: number | null;
  releasedByName: string | null;
  releasedAt: string | null;
  createdAt: string;
}
