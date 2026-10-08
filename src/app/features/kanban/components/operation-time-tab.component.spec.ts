import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OperationTimeTabComponent } from './operation-time-tab.component';
import { JobOperationRow } from '../../../shared/models/job-operation-row.model';
import { JobOperations } from '../../../shared/models/job-operations.model';
import { AuthService } from '../../../shared/services/auth.service';
import { BoardHubService } from '../../../shared/services/board-hub.service';
import { JobOperationsService } from '../../../shared/services/job-operations.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { JobCostService } from '../services/job-cost.service';
import { OperationTimeRow } from '../models/operation-time-row.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

const formatMinutes = (minutes: number): string =>
  OperationTimeTabComponent.prototype.formatMinutes.call(null, minutes);

describe('OperationTimeTabComponent.formatMinutes', () => {
  it('shows estimates under a minute in seconds', () => {
    expect(formatMinutes(0)).toBe('0s');
    expect(formatMinutes(0.75)).toBe('45s');
    expect(formatMinutes(42 / 60)).toBe('42s');
  });

  it('shows estimates under an hour as minutes and padded seconds', () => {
    expect(formatMinutes(1)).toBe('1m 00s');
    expect(formatMinutes(2.5)).toBe('2m 30s');
    expect(formatMinutes(12 + 5 / 60)).toBe('12m 05s');
    expect(formatMinutes(59 + 59 / 60)).toBe('59m 59s');
  });

  it('keeps hours and minutes for an hour or more', () => {
    expect(formatMinutes(60)).toBe('1h 0m');
    expect(formatMinutes(135)).toBe('2h 15m');
    expect(formatMinutes(90.4)).toBe('1h 30m');
  });
});

const JOB_ID = 42;

function op(overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 7,
    jobOperationId: 3,
    version: 5,
    stepNumber: 2,
    title: 'Mill',
    workCenterName: null,
    isRoutingStep: true,
    status: 'InProgress',
    completedQuantity: 20,
    scrapQuantity: 0,
    startedAt: null,
    completedAt: null,
    completedByName: null,
    estimatedSetupMinutes: 15,
    estimatedRunMinutesEach: 3,
    estimatedRunMinutesLot: 5,
    estimatedTotalMinutes: 140,
    actualSetupMinutes: 0,
    actualRunMinutes: 0,
    actualOtherMinutes: 0,
    actualTotalMinutes: 0,
    actualRunMinutesEach: null,
    remainingMinutes: 60,
    historyRunMinutesEach: null,
    historyJobCount: 0,
    openTimers: [],
    ...overrides,
  };
}

function payload(trackingEnabled: boolean, operations: JobOperationRow[] = [op()]): JobOperations {
  return {
    jobId: JOB_ID,
    jobQuantity: 40,
    trackingEnabled,
    allOperationsComplete: false,
    estimatedRemainingMinutes: 60,
    serverNow: new Date().toISOString(),
    operations,
  };
}

function setup(response: Observable<unknown>) {
  const operations = {
    getOperations: vi.fn().mockReturnValue(response),
    startTimer: vi.fn().mockReturnValue(of({})),
    stopTimer: vi.fn().mockReturnValue(of({ stopped: true, entry: null })),
    updateProgress: vi.fn(),
  };
  const cost = { getOperationTimeSummary: vi.fn().mockReturnValue(of([])) };
  const undo = new Subject<void>();
  const snackbar = { successWithAction: vi.fn().mockReturnValue(undo), success: vi.fn(), error: vi.fn() };
  const afterClosed = new Subject<unknown>();
  const dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => afterClosed }) };
  const jobUpdated = new Subject<unknown>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      { provide: JobOperationsService, useValue: operations },
      { provide: JobCostService, useValue: cost },
      { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      { provide: BoardHubService, useValue: { jobUpdated$: jobUpdated.asObservable() } },
      { provide: MatDialog, useValue: dialog },
      { provide: SnackbarService, useValue: snackbar },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new OperationTimeTabComponent());
  Object.defineProperty(component, 'jobId', { value: () => JOB_ID });
  TestBed.tick();
  return { component, operations, cost, snackbar, undo, dialog, afterClosed, jobUpdated };
}

function firstRow(component: OperationTimeTabComponent): OperationTimeRow {
  return component.operations()[0];
}

describe('OperationTimeTabComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('reads the operations endpoint and keeps today\'s columns while tracking is off', () => {
    const { component, operations, cost } = setup(of(payload(false)));

    expect(operations.getOperations).toHaveBeenCalledWith(JOB_ID);
    expect(cost.getOperationTimeSummary).not.toHaveBeenCalled();
    expect(component.trackingEnabled()).toBe(false);
    expect(component.opColumns().map(c => c.field)).toEqual([
      'operationSequence', 'operationName', 'estimatedSetupMinutes', 'actualSetupMinutes',
      'estimatedRunMinutes', 'actualRunMinutes', 'actualTotalMinutes', 'efficiencyPercent', 'progress',
    ]);
    expect(component.tableId()).toBe('operation-time-analysis');
    expect(firstRow(component).estimatedRunMinutes).toBe(125);
  });

  it('adds status, quantity, timers, per-piece, remaining and actions when tracking is on', () => {
    const { component } = setup(of(payload(true)));

    const fields = component.opColumns().map(c => c.field);
    expect(fields).toContain('status');
    expect(fields).toContain('completedQuantity');
    expect(fields).toContain('timers');
    expect(fields).toContain('perPiece');
    expect(fields).toContain('remainingMs');
    expect(fields).toContain('actions');
    expect(component.tableId()).toBe('operation-time-tracking');
    expect(component.remainingMs()).toBe(3600000);
  });

  it('falls back to the legacy summary when the operations endpoint is unavailable', () => {
    const { component, cost } = setup(throwError(() => new Error('403')));
    expect(cost.getOperationTimeSummary).toHaveBeenCalledWith(JOB_ID);
    expect(component.trackingEnabled()).toBe(false);
    expect(component.operations()).toEqual([]);
  });

  it('treats a payload without an operations array as empty', () => {
    const { component } = setup(of([]));
    expect(component.operations()).toEqual([]);
    expect(component.trackingEnabled()).toBe(false);
  });

  it('starts and stops the timer of one step', () => {
    const { component, operations } = setup(of(payload(true)));
    component.startTimer(firstRow(component), 'Setup');
    expect(operations.startTimer).toHaveBeenCalledWith(JOB_ID, 7, 'Setup');
    component.stopTimer(firstRow(component));
    expect(operations.stopTimer).toHaveBeenCalledWith(JOB_ID, 7);
    expect(operations.getOperations).toHaveBeenCalledTimes(3);
  });

  it('marks a step done with the row version, offers undo and reports the job finished', () => {
    const { component, operations, undo } = setup(of(payload(true)));
    operations.updateProgress.mockReturnValue(of({
      operation: op({ status: 'Complete', completedQuantity: 40, version: 6 }),
      allOperationsComplete: true,
      estimatedRemainingMinutes: 0,
    }));
    const finished = vi.fn();
    component.allOperationsComplete.subscribe(finished);

    component.markDone(firstRow(component));

    expect(operations.updateProgress).toHaveBeenCalledWith(JOB_ID, 7, { status: 'Complete', expectedVersion: 5 });
    expect(finished).toHaveBeenCalledOnce();

    undo.next();
    expect(operations.updateProgress).toHaveBeenLastCalledWith(JOB_ID, 7, {
      status: 'InProgress',
      completedQuantity: 20,
      scrapQuantity: 0,
      expectedVersion: 6,
    });
  });

  it('records a partial quantity from the dialog without completing the step', () => {
    const { component, operations, dialog, afterClosed } = setup(of(payload(true)));
    operations.updateProgress.mockReturnValue(of({
      operation: op({ completedQuantity: 30, version: 6 }),
      allOperationsComplete: false,
      estimatedRemainingMinutes: 30,
    }));
    const finished = vi.fn();
    component.allOperationsComplete.subscribe(finished);

    component.openQuantity(firstRow(component));
    expect(dialog.open.mock.calls[0][1].data).toEqual({
      title: 'Mill', jobQuantity: 40, completedQuantity: 20, scrapQuantity: 0,
    });
    afterClosed.next({ completedQuantity: 30, scrapQuantity: 1, complete: false });

    expect(operations.updateProgress).toHaveBeenCalledWith(JOB_ID, 7, {
      completedQuantity: 30,
      scrapQuantity: 1,
      status: null,
      expectedVersion: 5,
    });
    expect(finished).not.toHaveBeenCalled();
  });

  it('reloads when the board reports a change to this job only', async () => {
    vi.useFakeTimers();
    try {
      const { operations, jobUpdated } = setup(of(payload(true)));
      jobUpdated.next({ jobId: 99 });
      await vi.advanceTimersByTimeAsync(500);
      expect(operations.getOperations).toHaveBeenCalledTimes(1);

      jobUpdated.next({ jobId: JOB_ID });
      await vi.advanceTimersByTimeAsync(500);
      expect(operations.getOperations).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
