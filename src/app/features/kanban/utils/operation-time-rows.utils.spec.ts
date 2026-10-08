import { describe, it, expect } from 'vitest';

import { JobOperationRow } from '../../../shared/models/job-operation-row.model';
import { JobOperations } from '../../../shared/models/job-operations.model';
import {
  isJobOperations,
  legacyToOperationTimeRows,
  minutesToPreciseMs,
  minutesToSecondsMs,
  toOperationTimeRows,
} from './operation-time-rows.utils';

const LOADED_AT = Date.parse('2026-10-08T12:00:00Z');

function row(overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 7,
    jobOperationId: null,
    version: null,
    stepNumber: 2,
    title: 'Mill',
    workCenterName: null,
    isRoutingStep: true,
    status: 'NotStarted',
    completedQuantity: 0,
    scrapQuantity: 0,
    startedAt: null,
    completedAt: null,
    completedByName: null,
    estimatedSetupMinutes: 15,
    estimatedRunMinutesEach: 3,
    estimatedRunMinutesLot: 5,
    estimatedTotalMinutes: 50,
    actualSetupMinutes: 0,
    actualRunMinutes: 0,
    actualOtherMinutes: 0,
    actualTotalMinutes: 0,
    actualRunMinutesEach: null,
    remainingMinutes: 50,
    historyRunMinutesEach: null,
    historyJobCount: 0,
    openTimers: [],
    ...overrides,
  };
}

function payload(operations: JobOperationRow[]): JobOperations {
  return {
    jobId: 42,
    jobQuantity: 10,
    trackingEnabled: true,
    allOperationsComplete: false,
    estimatedRemainingMinutes: 50,
    serverNow: new Date(LOADED_AT).toISOString(),
    operations,
  };
}

describe('operation time rows', () => {
  it('splits the quantity-scaled estimate into setup and run', () => {
    const [mapped] = toOperationTimeRows(payload([row()]), 1, LOADED_AT, LOADED_AT);
    expect(mapped.estimatedSetupMinutes).toBe(15);
    expect(mapped.estimatedRunMinutes).toBe(35);
    expect(mapped.estimatedEachMs).toBe(180000);
    expect(mapped.remainingMs).toBe(3000000);
    expect(mapped.canAct).toBe(true);
    expect(mapped.closed).toBe(false);
  });

  it('adds live time for each open timer by entry type', () => {
    const timers = [
      { timeEntryId: 1, userId: 1, userName: 'Rivera, Sam', userInitials: 'SR', entryType: 'Run', timerStart: '2026-10-08T11:58:00Z' },
      { timeEntryId: 2, userId: 2, userName: 'Lee, Ana', userInitials: null, entryType: 'Setup', timerStart: '2026-10-08T11:59:00Z' },
    ];
    const [mapped] = toOperationTimeRows(
      payload([row({ actualRunMinutes: 2, actualSetupMinutes: 1, actualTotalMinutes: 3, openTimers: timers })]),
      1, LOADED_AT + 60000, LOADED_AT);

    expect(mapped.actualRunMinutes).toBeCloseTo(3);
    expect(mapped.actualSetupMinutes).toBeCloseTo(2);
    expect(mapped.actualTotalMinutes).toBeCloseTo(5);
    expect(mapped.myTimer?.timeEntryId).toBe(1);
    expect(mapped.myElapsedMs).toBe(180000);
    expect(mapped.otherInitials).toEqual(['LE']);
  });

  it('marks complete and skipped steps closed and off-routing steps read-only', () => {
    const rows = toOperationTimeRows(payload([
      row({ status: 'Complete' }),
      row({ status: 'Skipped', stepNumber: 3 }),
      row({ operationId: null, isRoutingStep: false, stepNumber: 4, jobOperationId: 9 }),
    ]), 1, LOADED_AT, LOADED_AT);
    expect(rows.map(r => r.closed)).toEqual([true, true, false]);
    expect(rows.map(r => r.canAct)).toEqual([true, true, false]);
    expect(rows[2].id).toBe('jo-9');
  });

  it('maps the legacy summary without any tracking affordances', () => {
    const [mapped] = legacyToOperationTimeRows([{
      operationId: 7, operationName: 'Mill', operationSequence: 2,
      estimatedSetupMinutes: 15, estimatedRunMinutes: 8, actualSetupMinutes: 10, actualRunMinutes: 9,
      actualTotalMinutes: 19, setupVarianceMinutes: -5, runVarianceMinutes: 1, efficiencyPercent: 121, entryCount: 3,
    }]);
    expect(mapped.estimatedRunMinutes).toBe(8);
    expect(mapped.efficiencyPercent).toBe(121);
    expect(mapped.canAct).toBe(false);
  });

  it('recognises only payloads that carry an operations array', () => {
    expect(isJobOperations(payload([]))).toBe(true);
    expect(isJobOperations([])).toBe(false);
    expect(isJobOperations(null)).toBe(false);
  });

  it('rounds elapsed and remaining to whole seconds but keeps per-piece precision', () => {
    expect(minutesToSecondsMs(1.2345)).toBe(74000);
    expect(minutesToPreciseMs(0.1234)).toBe(7404);
    expect(minutesToPreciseMs(0)).toBeNull();
  });
});
