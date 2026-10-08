import { JobOperationRow } from '../../../shared/models/job-operation-row.model';
import { JOB_OPERATION_STATUS_DISPLAY } from '../../../shared/models/job-operation-status-display.const';
import { JobOperations } from '../../../shared/models/job-operations.model';
import { elapsedMs } from '../../../shared/utils/elapsed-ms';
import { OperationTimeAnalysis } from '../models/operation-time.model';
import { OperationTimeRow } from '../models/operation-time-row.model';

export function minutesToSecondsMs(minutes: number | null | undefined): number {
  return Math.max(0, Math.round((minutes ?? 0) * 60) * 1000);
}

export function minutesToPreciseMs(minutes: number | null | undefined): number | null {
  if (minutes === null || minutes === undefined || minutes <= 0) return null;
  return Math.round(minutes * 60000);
}

export function efficiencyPercent(estimatedMinutes: number, actualMinutes: number): number {
  return actualMinutes > 0 ? (estimatedMinutes / actualMinutes) * 100 : 0;
}

export function isJobOperations(value: unknown): value is JobOperations {
  return !!value && typeof value === 'object' && Array.isArray((value as JobOperations).operations);
}

export function toOperationTimeRows(
  data: JobOperations,
  currentUserId: number | null,
  liveNowMs: number,
  loadedAtMs: number,
): OperationTimeRow[] {
  const liveDeltaMinutes = Math.max(0, liveNowMs - loadedAtMs) / 60000;
  const serverNowMs = new Date(data.serverNow).getTime();
  const clockOffsetMs = Number.isNaN(serverNowMs) ? 0 : serverNowMs - loadedAtMs;
  return data.operations.map(op => toRow(op, currentUserId, liveDeltaMinutes, liveNowMs + clockOffsetMs));
}

function toRow(
  op: JobOperationRow,
  currentUserId: number | null,
  liveDeltaMinutes: number,
  serverNowMs: number,
): OperationTimeRow {
  const timers = op.openTimers ?? [];
  const live = (types: string[] | null) => timers
    .filter(t => types === null ? true : types.includes(t.entryType))
    .length * liveDeltaMinutes;

  const actualSetup = op.actualSetupMinutes + live(['Setup']);
  const actualRun = op.actualRunMinutes + live(['Run']);
  const actualTotal = op.actualTotalMinutes + live(null);
  const estimatedSetup = op.estimatedSetupMinutes;
  const estimatedRun = Math.max(0, op.estimatedTotalMinutes - op.estimatedSetupMinutes);
  const mine = currentUserId === null ? null : timers.find(t => t.userId === currentUserId) ?? null;
  const display = JOB_OPERATION_STATUS_DISPLAY[op.status] ?? JOB_OPERATION_STATUS_DISPLAY.NotStarted;

  return {
    id: op.jobOperationId !== null ? `jo-${op.jobOperationId}` : `op-${op.operationId ?? op.stepNumber}`,
    operationSequence: op.stepNumber,
    operationName: op.title,
    status: op.status,
    statusLabelKey: display.labelKey,
    statusChipClass: display.chipClass,
    completedQuantity: op.completedQuantity,
    scrapQuantity: op.scrapQuantity,
    estimatedSetupMinutes: estimatedSetup,
    estimatedRunMinutes: estimatedRun,
    actualSetupMinutes: actualSetup,
    actualRunMinutes: actualRun,
    actualTotalMinutes: actualTotal,
    setupVarianceMinutes: actualSetup - estimatedSetup,
    runVarianceMinutes: actualRun - estimatedRun,
    efficiencyPercent: efficiencyPercent(estimatedSetup + estimatedRun, actualTotal),
    estimatedEachMs: minutesToPreciseMs(op.estimatedRunMinutesEach),
    actualEachMs: minutesToPreciseMs(op.actualRunMinutesEach),
    historyEachMs: minutesToPreciseMs(op.historyRunMinutesEach),
    historyJobCount: op.historyJobCount,
    remainingMs: minutesToSecondsMs(op.remainingMinutes),
    myTimer: mine,
    myElapsedMs: mine ? elapsedMs(mine.timerStart, serverNowMs) : 0,
    otherInitials: timers
      .filter(t => t.userId !== currentUserId)
      .map(t => t.userInitials ?? t.userName.slice(0, 2).toUpperCase()),
    canAct: op.operationId !== null && op.isRoutingStep,
    closed: op.status === 'Complete' || op.status === 'Skipped',
    source: op,
  };
}

export function legacyToOperationTimeRows(ops: OperationTimeAnalysis[]): OperationTimeRow[] {
  const display = JOB_OPERATION_STATUS_DISPLAY.NotStarted;
  return ops.map(op => ({
    id: `op-${op.operationId}`,
    operationSequence: op.operationSequence,
    operationName: op.operationName,
    status: 'NotStarted',
    statusLabelKey: display.labelKey,
    statusChipClass: display.chipClass,
    completedQuantity: 0,
    scrapQuantity: 0,
    estimatedSetupMinutes: op.estimatedSetupMinutes,
    estimatedRunMinutes: op.estimatedRunMinutes,
    actualSetupMinutes: op.actualSetupMinutes,
    actualRunMinutes: op.actualRunMinutes,
    actualTotalMinutes: op.actualTotalMinutes,
    setupVarianceMinutes: op.setupVarianceMinutes,
    runVarianceMinutes: op.runVarianceMinutes,
    efficiencyPercent: op.efficiencyPercent,
    estimatedEachMs: null,
    actualEachMs: null,
    historyEachMs: null,
    historyJobCount: 0,
    remainingMs: 0,
    myTimer: null,
    myElapsedMs: 0,
    otherInitials: [],
    canAct: false,
    closed: false,
    source: null,
  }));
}
