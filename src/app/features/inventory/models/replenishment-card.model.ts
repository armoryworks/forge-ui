import { KanbanCardStatus } from './kanban-card-status.type';
import { KanbanSupplySource } from './kanban-supply-source.type';

export interface ReplenishmentCard {
  id: number;
  cardNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string;
  workCenterId: number;
  workCenterName: string;
  storageLocationId: number | null;
  storageLocationName: string | null;
  binQuantity: number;
  numberOfBins: number;
  status: KanbanCardStatus;
  supplySource: KanbanSupplySource;
  supplyVendorId: number | null;
  supplyVendorName: string | null;
  supplyWorkCenterId: number | null;
  leadTimeDays: number | null;
  lastTriggeredAt: string | null;
  lastReplenishedAt: string | null;
  activeOrderId: number | null;
  activeOrderType: string | null;
  triggerCount: number;
  isActive: boolean;
}
