export interface AbcClassificationRun {
  id: number;
  runDate: string;
  totalParts: number;
  classACount: number;
  classBCount: number;
  classCCount: number;
  classAThresholdPercent: number;
  classBThresholdPercent: number;
  totalAnnualUsageValue: number;
  lookbackMonths: number;
}
