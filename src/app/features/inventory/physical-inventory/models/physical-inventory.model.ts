import { PhysicalInventoryStatus } from './physical-inventory-status.type';

export interface PhysicalInventory {
  id: number;
  inventoryNumber: string;
  description: string | null;
  scopeLocationId: number | null;
  scopeLocationName: string | null;
  status: PhysicalInventoryStatus;
  countDate: string;
  blindCount: boolean;
  recountTolerancePercent: number;
  notes: string | null;
  frozenAt: string | null;
  postedAt: string | null;
  cancelledAt: string | null;
  totalVarianceValue: number;
  tagCount: number;
  countedTagCount: number;
  recountTagCount: number;
  bookQuantitiesVisible: boolean;
  createdAt: string;
}
