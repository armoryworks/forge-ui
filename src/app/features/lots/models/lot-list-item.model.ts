export interface LotListItem {
  id: number;
  lotNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string;
  jobId: number | null;
  jobNumber: string | null;
  quantity: number;
  expirationDate: Date | null;
  supplierLotNumber: string | null;
  createdAt: Date;
}
