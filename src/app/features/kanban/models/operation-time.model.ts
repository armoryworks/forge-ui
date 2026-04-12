export interface OperationTimeAnalysis {
  operationId: number;
  operationName: string;
  operationSequence: number;
  estimatedSetupMinutes: number;
  estimatedRunMinutes: number;
  actualSetupMinutes: number;
  actualRunMinutes: number;
  actualTotalMinutes: number;
  setupVarianceMinutes: number;
  runVarianceMinutes: number;
  efficiencyPercent: number;
  entryCount: number;
}
