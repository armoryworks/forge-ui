import { ProductionRunStatus } from './production-run-status.type';

export interface ProductionRun {
  id: number;
  jobId: number;
  jobNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string;
  operatorId: number | null;
  operatorName: string | null;
  runNumber: string;
  targetQuantity: number;
  completedQuantity: number;
  scrapQuantity: number;
  status: ProductionRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  setupTimeMinutes: number | null;
  runTimeMinutes: number | null;
  yieldPercentage: number;
  receivedQuantity: number;
  receivedToStockAt: string | null;
  workCenterId: number | null;
  workCenterName: string | null;
  toolingAssetId: number | null;
  toolingAssetName: string | null;
  toolingCavityCount: number | null;
  shotsApplied: number;
  runTimeManual: boolean;
  receiptJournalEntryNumber: number | null;
}
