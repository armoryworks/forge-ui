export interface EarnedValue {
  budgetedCostOfWorkScheduled: number;
  budgetedCostOfWorkPerformed: number;
  actualCostOfWorkPerformed: number;
  scheduleVariance: number;
  costVariance: number;
  schedulePerformanceIndex: number;
  costPerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
}
