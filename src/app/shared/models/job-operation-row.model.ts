import { JobOperationOpenTimer } from './job-operation-open-timer.model';
import { JobOperationStatus } from './job-operation-status.type';

export interface JobOperationRow {
  operationId: number | null;
  jobOperationId: number | null;
  version: number | null;
  stepNumber: number;
  title: string;
  workCenterName: string | null;
  isRoutingStep: boolean;
  status: JobOperationStatus;
  completedQuantity: number;
  scrapQuantity: number;
  startedAt: string | null;
  completedAt: string | null;
  completedByName: string | null;
  estimatedSetupMinutes: number;
  estimatedRunMinutesEach: number;
  estimatedRunMinutesLot: number;
  estimatedTotalMinutes: number;
  actualSetupMinutes: number;
  actualRunMinutes: number;
  actualOtherMinutes: number;
  actualTotalMinutes: number;
  actualRunMinutesEach: number | null;
  remainingMinutes: number;
  historyRunMinutesEach: number | null;
  historyJobCount: number;
  openTimers: JobOperationOpenTimer[];
}
