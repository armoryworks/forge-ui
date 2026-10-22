export interface LaborRecomputeJobChange {
  jobId: number;
  jobNumber: string;
  entriesChanged: number;
  laborMinutesBefore: number;
  laborMinutesAfter: number;
  laborCostBefore: number;
  laborCostAfter: number;
  burdenCostBefore: number;
  burdenCostAfter: number;
}
