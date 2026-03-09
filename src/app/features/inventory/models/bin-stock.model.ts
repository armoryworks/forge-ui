import { BinContentStatus } from './bin-content-status.type';

export interface BinStock {
  locationId: number;
  locationName: string;
  locationPath: string;
  quantity: number;
  status: BinContentStatus;
  lotNumber: string | null;
}
