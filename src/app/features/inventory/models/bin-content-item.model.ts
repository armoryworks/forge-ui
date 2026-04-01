import { BinContentStatus } from './bin-content-status.type';

export interface BinContentItem {
  id: number;
  locationId: number;
  locationName: string;
  locationPath: string;
  entityType: string;
  entityId: number;
  entityName: string;
  quantity: number;
  lotNumber: string | null;
  jobId: number | null;
  jobNumber: string | null;
  status: BinContentStatus;
  placedAt: Date;
}
