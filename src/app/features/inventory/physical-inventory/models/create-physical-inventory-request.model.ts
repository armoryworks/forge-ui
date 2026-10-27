export interface CreatePhysicalInventoryRequest {
  description: string | null;
  scopeLocationId: number | null;
  countDate: string;
  blindCount: boolean;
  recountTolerancePercent: number;
  notes: string | null;
}
