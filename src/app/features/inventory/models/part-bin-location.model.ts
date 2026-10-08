import { BinContentStatus } from './bin-content-status.type';

export interface PartBinLocation {
  binContentId: number;
  locationPath: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lotNumber: string | null;
  status: BinContentStatus;
}
