import { JobOperationOpenTimer } from '../../../shared/models/job-operation-open-timer.model';
import { JobOperationRow } from '../../../shared/models/job-operation-row.model';
import { JobOperationStatus } from '../../../shared/models/job-operation-status.type';

export interface OperationTimeRow {
  id: string;
  operationSequence: number;
  operationName: string;
  status: JobOperationStatus;
  statusLabelKey: string;
  statusChipClass: string;
  completedQuantity: number;
  scrapQuantity: number;
  estimatedSetupMinutes: number;
  estimatedRunMinutes: number;
  actualSetupMinutes: number;
  actualRunMinutes: number;
  actualTotalMinutes: number;
  setupVarianceMinutes: number;
  runVarianceMinutes: number;
  efficiencyPercent: number;
  estimatedEachMs: number | null;
  actualEachMs: number | null;
  historyEachMs: number | null;
  historyJobCount: number;
  remainingMs: number;
  myTimer: JobOperationOpenTimer | null;
  myElapsedMs: number;
  otherInitials: string[];
  canAct: boolean;
  closed: boolean;
  source: JobOperationRow | null;
}
