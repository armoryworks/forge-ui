import { KanbanSupplySource } from './kanban-supply-source.type';

export interface ReplenishmentCardRequest {
  partId?: number;
  workCenterId?: number;
  storageLocationId: number | null;
  binQuantity: number;
  numberOfBins: number;
  supplySource: KanbanSupplySource;
  supplyVendorId: number | null;
  supplyWorkCenterId: number | null;
  leadTimeDays: number | null;
  isActive?: boolean;
}
