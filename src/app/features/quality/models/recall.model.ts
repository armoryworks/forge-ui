import { RecallStatus } from './recall-status.model';

export interface Recall {
  id: number;
  initiatedLotId: number;
  initiatedLotNumber: string;
  reason: string;
  recallDate: Date;
  status: RecallStatus;
  affectedLotsCount: number;
  affectedShipmentsCount: number;
  totalQuarantinedQuantity: number;
  resolvedAt: Date | null;
  createdAt: Date;
}
