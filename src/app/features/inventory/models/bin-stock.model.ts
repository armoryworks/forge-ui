import { BinContentStatus } from './bin-content-status.type';

export interface BinStock {
  locationId: number;
  locationName: string;
  locationPath: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: BinContentStatus;
  lotNumber: string | null;
}
