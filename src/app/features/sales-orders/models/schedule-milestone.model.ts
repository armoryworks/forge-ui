export interface ScheduleMilestone {
  salesOrderLineId: number;
  partNumber: string | null;
  partDescription: string | null;
  deliveryDate: string | null;
  shipBy: string | null;
  qcCompleteBy: string | null;
  productionCompleteBy: string | null;
  productionStartBy: string | null;
  materialsNeededBy: string | null;
  poOrderBy: string | null;
  isAtRisk: boolean;
}
