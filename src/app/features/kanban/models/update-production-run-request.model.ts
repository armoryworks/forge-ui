import { ProductionRunStatus } from './production-run-status.type';

export interface UpdateProductionRunRequest {
  completedQuantity: number;
  scrapQuantity: number;
  status: ProductionRunStatus;
  notes: string | null;
  setupTimeMinutes: number | null;
  runTimeMinutes: number | null;
  toolingAssetId: number | null;
}
