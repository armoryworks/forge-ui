import { ProductionRun } from './production-run.model';

export interface ProductionRunRow {
  run: ProductionRun;
  statusLabelKey: string;
  statusChipClass: string;
  canStart: boolean;
  canStop: boolean;
  canEdit: boolean;
  canReceive: boolean;
  received: boolean;
  runTimeLabelKey: string | null;
}
