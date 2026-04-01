import { BinMovementReason } from './bin-movement-reason.type';

export interface BinMovementItem {
  id: number;
  entityType: string;
  entityId: number;
  entityName: string;
  quantity: number;
  lotNumber: string | null;
  fromLocationId: number | null;
  fromLocationName: string | null;
  toLocationId: number | null;
  toLocationName: string | null;
  movedByName: string;
  movedAt: Date;
  reason: BinMovementReason | null;
}
