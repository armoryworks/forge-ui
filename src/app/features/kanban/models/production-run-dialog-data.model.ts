import { ProductionRun } from './production-run.model';

export interface ProductionRunDialogData {
  jobId: number;
  partId: number;
  defaultTargetQuantity: number | null;
  run: ProductionRun | null;
}
