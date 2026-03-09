import { BinContentStatus } from './bin-content-status.type';

export interface PlaceBinContentRequest {
  locationId: number;
  entityType: string;
  entityId: number;
  quantity: number;
  lotNumber?: string;
  jobId?: number;
  status: BinContentStatus;
  notes?: string;
}
