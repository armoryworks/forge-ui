export interface OeeCalculation {
  workCenterId: number;
  workCenterName: string;
  periodStart: string;
  periodEnd: string;
  scheduledMinutes: number;
  plannedDowntimeMinutes: number;
  unplannedDowntimeMinutes: number;
  availableMinutes: number;
  runTimeMinutes: number;
  totalQuantity: number;
  goodQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  idealCycleTimeSeconds: number;
  availability: number;
  performance: number;
  quality: number;
  oee: number;
  oeePercent: number;
  isWorldClass: boolean;
}
