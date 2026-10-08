import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanJobFlowComponent } from './scan-job-flow.component';
import { ShopFloorService } from '../../services/shop-floor.service';
import { KanbanService } from '../../../kanban/services/kanban.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { JobStatus } from '../../../../shared/models/mobile-api.model';
import { JobOperationRow } from '../../models/job-operation-row.model';
import { JobOperations } from '../../models/job-operations.model';

interface FlowInternals {
  step: () => string;
  error: () => string | null;
  canAdvance: () => boolean;
  advancedTo: () => string | null;
  showAdvanceStage(): void;
  confirmAdvanceStage(): void;
}

function status(nextStageId: number | null, nextStageName = 'QC/Review', nextStageIsShopFloor = true): JobStatus {
  return {
    id: 5, jobNumber: 'JOB-0005', title: 'Bracket', customerName: null,
    stageId: 6, stageName: 'In Production', stageColor: '#000', dueDate: null, isOverdue: false,
    nextStageId, nextStageName: nextStageId ? nextStageName : null,
    nextStageIsShopFloor: nextStageId ? nextStageIsShopFloor : false,
    previousStageId: null, previousStageName: null, rowVersion: 1, recentActivity: [],
  };
}

describe('ScanJobFlowComponent — next status', () => {
  const shopFloor = {
    getJobStatus: vi.fn(), advanceJob: vi.fn(), completeJob: vi.fn(),
    getConfig: vi.fn(() => of({ operationTracking: false })),
  };

  function create(): FlowInternals {
    const fixture = TestBed.createComponent(ScanJobFlowComponent);
    fixture.componentRef.setInput('jobId', 5);
    fixture.componentRef.setInput('jobNumber', 'JOB-0005');
    fixture.componentRef.setInput('jobTitle', 'Bracket');
    fixture.componentRef.setInput('currentStage', 'In Production');
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance as unknown as FlowInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ScanJobFlowComponent],
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: KanbanService, useValue: {} },
        { provide: AuthService, useValue: { user: () => ({ id: 3 }) } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, string>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      ],
    });
    TestBed.overrideComponent(ScanJobFlowComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('advances through the kiosk advance endpoint, not complete-job', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(7)));
    shopFloor.advanceJob.mockReturnValue(of({
      status: { ...status(null), stageId: 7, stageName: 'QC/Review' },
      previousStageId: 6, previousStageName: 'In Production', collapsed: false,
    }));
    const c = create();

    c.showAdvanceStage();
    expect(c.step()).toBe('confirm-advance');
    c.confirmAdvanceStage();

    expect(shopFloor.advanceJob).toHaveBeenCalledWith(5);
    expect(shopFloor.completeJob).not.toHaveBeenCalled();
    expect(c.step()).toBe('done');
    expect(c.advancedTo()).toBe('QC/Review');
  });

  it('cannot advance when there is no next status', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(null)));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    c.showAdvanceStage();
    expect(c.step()).toBe('actions');
  });

  it('cannot advance when the next status is an office status', () => {
    shopFloor.getJobStatus.mockReturnValue(of({ ...status(9, 'Invoiced/Sent', false), stageName: 'Shipped' }));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    c.showAdvanceStage();
    expect(c.step()).toBe('actions');
    expect(shopFloor.advanceJob).not.toHaveBeenCalled();
  });

  it('reports a status that failed to load without claiming a move was tried', () => {
    shopFloor.getJobStatus.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 404, error: { detail: 'Job 5 not found' } })));
    const c = create();

    expect(c.canAdvance()).toBe(false);
    expect(c.error()).toBe('shopFloor.jobFlow.statusLoadFailed:{"reason":"Job 5 not found"}');
  });

  it('shows the server reason when the move is refused', () => {
    shopFloor.getJobStatus.mockReturnValue(of(status(7)));
    shopFloor.advanceJob.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'Open NCR.' } })));
    const c = create();

    c.showAdvanceStage();
    c.confirmAdvanceStage();

    expect(c.step()).toBe('actions');
    expect(c.error()).toBe('shopFloor.jobFlow.advanceFailed:{"reason":"Open NCR."}');
  });
});

interface TrackingInternals {
  step: () => string;
  error: () => string | null;
  tracking: () => boolean;
  jobOperations: () => JobOperations | null;
  runningTimers: () => unknown[];
  operationNotice: () => string | null;
  now: () => number;
  jobTimerRunning: () => boolean;
  startTimer(): void;
  stopTimer(): void;
  confirmAdvanceStage(): void;
  startOperation(row: JobOperationRow, entryType?: 'Run' | 'Setup'): void;
  stopOperation(row: JobOperationRow): void;
  stopRunningTimer(timer: { id: number; jobNumber: string }): void;
  openQuantity(row: JobOperationRow, prefillAll: boolean): void;
  submitQuantity(request: Record<string, unknown>): void;
}

function opRow(stepNumber: number, overrides: Partial<JobOperationRow> = {}): JobOperationRow {
  return {
    operationId: 100 + stepNumber, jobOperationId: null, version: null, stepNumber, title: `Step ${stepNumber}`,
    workCenterName: null, isRoutingStep: true, status: 'NotStarted', completedQuantity: 0, scrapQuantity: 0,
    startedAt: null, completedAt: null, completedByName: null,
    estimatedSetupMinutes: 0, estimatedRunMinutesEach: 1, estimatedRunMinutesLot: 0, estimatedTotalMinutes: 40,
    actualSetupMinutes: 0, actualRunMinutes: 0, actualOtherMinutes: 0, actualTotalMinutes: 0,
    actualRunMinutesEach: null, remainingMinutes: 40, historyRunMinutesEach: null, historyJobCount: 0, openTimers: [],
    ...overrides,
  };
}

function operations(rows: JobOperationRow[]): JobOperations {
  return {
    jobId: 5, jobQuantity: 40, trackingEnabled: true, allOperationsComplete: false,
    estimatedRemainingMinutes: 80, serverNow: new Date(Date.now() + 5_000).toISOString(), operations: rows,
  };
}

describe('ScanJobFlowComponent — operation tracking', () => {
  const shopFloor = {
    getJobStatus: vi.fn(() => of(status(7))),
    advanceJob: vi.fn(() => of({
      status: { ...status(null), stageId: 7, stageName: 'QC/Review' },
      previousStageId: 6, previousStageName: 'In Production', collapsed: false,
    })),
    completeJob: vi.fn(),
    startTimer: vi.fn(() => of({})),
    stopTimer: vi.fn((_target?: unknown) => of({})),
    getConfig: vi.fn(() => of({ operationTracking: false })),
    getOperations: vi.fn(() => of(operations([opRow(1), opRow(2)]))),
    getActiveTimers: vi.fn(() => of([] as unknown[])),
    startOperationTimer: vi.fn(),
    stopOperationTimer: vi.fn(() => of({ stopped: true, entry: null })),
    updateOperationProgress: vi.fn(),
  };

  function create(): TrackingInternals {
    const fixture = TestBed.createComponent(ScanJobFlowComponent);
    fixture.componentRef.setInput('jobId', 5);
    fixture.componentRef.setInput('jobNumber', 'JOB-0005');
    fixture.componentRef.setInput('jobTitle', 'Bracket');
    fixture.componentRef.setInput('currentStage', 'In Production');
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance as unknown as TrackingInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [ScanJobFlowComponent],
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: KanbanService, useValue: {} },
        { provide: AuthService, useValue: { user: () => ({ id: 3 }) } },
        { provide: CapabilityService, useValue: { isEnabled: () => false } },
        { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, unknown>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      ],
    });
    TestBed.overrideComponent(ScanJobFlowComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('tracking off sends exactly today\'s requests and nothing about operations', () => {
    const c = create();

    expect(c.tracking()).toBe(false);
    c.startTimer();
    expect(shopFloor.startTimer).toHaveBeenCalledWith(5);
    vi.advanceTimersByTime(1_500);
    (c as unknown as { step: { set: (s: string) => void } }).step.set('actions');
    c.stopTimer();
    expect(shopFloor.stopTimer).toHaveBeenCalledTimes(1);
    expect(shopFloor.stopTimer.mock.calls[0]).toEqual([]);

    expect(shopFloor.getOperations).not.toHaveBeenCalled();
    expect(shopFloor.getActiveTimers).not.toHaveBeenCalled();
    expect(shopFloor.startOperationTimer).not.toHaveBeenCalled();
    expect(shopFloor.updateOperationProgress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(shopFloor.getOperations).not.toHaveBeenCalled();
  });

  it('tracking on loads the operations and the badge user\'s running timers', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.getActiveTimers.mockReturnValueOnce(of([{ id: 9, jobNumber: 'JOB-0005', timerStart: new Date().toISOString() }]));
    const c = create();

    expect(c.tracking()).toBe(true);
    expect(shopFloor.getOperations).toHaveBeenCalledWith(5);
    expect(c.jobOperations()?.operations.length).toBe(2);
    expect(c.runningTimers().length).toBe(1);
  });

  it('ticks with the server clock offset', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    const c = create();
    const before = Date.now();
    vi.advanceTimersByTime(1_000);
    expect(c.now() - (before + 1_000)).toBeGreaterThanOrEqual(4_900);
  });

  it('the whole-job stop names this job when tracking is on', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    const c = create();
    c.stopTimer();
    expect(shopFloor.stopTimer).toHaveBeenCalledWith({ jobId: 5 });
  });

  it('the whole-job button follows the running timers, not the stale input, when tracking is on', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.getActiveTimers
      .mockReturnValueOnce(of([{ id: 9, jobId: 5, jobNumber: 'JOB-0005', timerStart: new Date().toISOString() }]))
      .mockReturnValueOnce(of([]));
    const c = create();
    expect(c.jobTimerRunning()).toBe(true);

    c.stopRunningTimer({ id: 9, jobNumber: 'JOB-0005' });
    expect(c.jobTimerRunning()).toBe(false);
  });

  it('a refused whole-job stop shows the server reason and reloads the timers', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.stopTimer.mockReturnValueOnce(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'Several timers are running.' } })));
    const c = create();

    c.stopTimer();
    expect(c.step()).toBe('actions');
    expect(c.error()).toBe('shopFloor.operations.actionFailed:{"reason":"Several timers are running."}');
    expect(shopFloor.getActiveTimers).toHaveBeenCalledTimes(2);
  });

  it('starts a run or setup timer on one operation and keeps the flow open', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    const running = opRow(2, { status: 'InProgress', openTimers: [{ timeEntryId: 9, userId: 3, userName: 'Doe, Pat', userInitials: 'PD', entryType: 'Run', timerStart: new Date().toISOString() }] });
    shopFloor.startOperationTimer.mockReturnValue(of({ entry: { id: 9 }, alreadyRunning: false, operation: running }));
    const c = create();

    c.startOperation(opRow(2));
    expect(shopFloor.startOperationTimer).toHaveBeenCalledWith(5, 102, 'Run');
    expect(c.step()).toBe('actions');
    expect(c.jobOperations()?.operations[1].status).toBe('InProgress');
    expect(c.operationNotice()).toBe('shopFloor.operations.started:{"step":2,"title":"Step 2"}');
    expect(shopFloor.getActiveTimers).toHaveBeenCalledTimes(2);

    c.startOperation(opRow(1), 'Setup');
    expect(shopFloor.startOperationTimer).toHaveBeenLastCalledWith(5, 101, 'Setup');
  });

  it('a refused start shows the server reason', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.startOperationTimer.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'Reopen the operation first.' } })));
    const c = create();

    c.startOperation(opRow(1));
    expect(c.error()).toBe('shopFloor.operations.actionFailed:{"reason":"Reopen the operation first."}');
    expect(shopFloor.getOperations).toHaveBeenCalledTimes(2);
  });

  it('stops one operation timer and a running timer by its entry', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    const c = create();

    c.stopOperation(opRow(2));
    expect(shopFloor.stopOperationTimer).toHaveBeenCalledWith(5, 102);
    c.stopRunningTimer({ id: 9, jobNumber: 'JOB-0005' });
    expect(shopFloor.stopTimer).toHaveBeenCalledWith({ timeEntryId: 9 });
  });

  it('a Done that completes the last operation offers the gated move to the next status', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.updateOperationProgress.mockReturnValue(of({
      operation: opRow(2, { status: 'Complete', completedQuantity: 40 }), allOperationsComplete: true, estimatedRemainingMinutes: 0,
    }));
    const c = create();

    c.openQuantity(opRow(2), true);
    expect(c.step()).toBe('quantity');
    c.submitQuantity({ completedQuantity: 40, scrapQuantity: 0, expectedVersion: null, status: 'Complete' });

    expect(shopFloor.updateOperationProgress).toHaveBeenCalledWith(5, 102,
      { completedQuantity: 40, scrapQuantity: 0, expectedVersion: null, status: 'Complete' });
    expect(c.jobOperations()?.allOperationsComplete).toBe(true);
    expect(c.step()).toBe('confirm-advance');
    c.confirmAdvanceStage();
    expect(shopFloor.advanceJob).toHaveBeenCalledWith(5);
  });

  it('a partial count goes back to the tiles with a confirmation', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.updateOperationProgress.mockReturnValue(of({
      operation: opRow(2, { status: 'InProgress', completedQuantity: 20 }), allOperationsComplete: false, estimatedRemainingMinutes: 60,
    }));
    const c = create();

    c.openQuantity(opRow(2), false);
    c.submitQuantity({ completedQuantity: 20, scrapQuantity: 0, expectedVersion: null });
    expect(c.step()).toBe('actions');
    expect(c.operationNotice()).toBe('shopFloor.operations.recorded:{"step":2,"count":20,"total":40}');
  });

  it('a stale count shows the conflict and reloads', () => {
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    shopFloor.updateOperationProgress.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'This operation was changed by someone else — refresh and try again.' } })));
    const c = create();

    c.openQuantity(opRow(2), false);
    c.submitQuantity({ completedQuantity: 20, scrapQuantity: 0, expectedVersion: 1 });
    expect(c.step()).toBe('actions');
    expect(c.error()).toContain('changed by someone else');
    expect(shopFloor.getOperations).toHaveBeenCalledTimes(2);
  });
});

interface ProblemInternals {
  step: () => string;
  error: () => string | null;
  andonEnabled: () => boolean;
  problemType: () => string | null;
  problemRaisedAt: () => string | null;
  problemNoteControl: { setValue(value: string): void };
  showProblem(): void;
  selectProblemType(type: string): void;
  submitProblem(): void;
}

describe('ScanJobFlowComponent — problem button', () => {
  const shopFloor = {
    getJobStatus: vi.fn(() => of(status(7))),
    getConfig: vi.fn(() => of({ operationTracking: false })),
    raiseAndon: vi.fn(),
  };
  let andonOn = true;

  function create(): { flow: ProblemInternals; completed: ReturnType<typeof vi.fn> } {
    const fixture = TestBed.createComponent(ScanJobFlowComponent);
    fixture.componentRef.setInput('jobId', 5);
    fixture.componentRef.setInput('jobNumber', 'JOB-0005');
    fixture.componentRef.setInput('jobTitle', 'Bracket');
    fixture.componentRef.setInput('currentStage', 'In Production');
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);
    fixture.componentInstance.ngOnInit();
    return { flow: fixture.componentInstance as unknown as ProblemInternals, completed };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    andonOn = true;
    TestBed.configureTestingModule({
      imports: [ScanJobFlowComponent],
      providers: [
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: KanbanService, useValue: {} },
        { provide: AuthService, useValue: { user: () => ({ id: 3 }) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code === 'CAP-EXT-ANDON' && andonOn } },
        { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, unknown>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      ],
    });
    TestBed.overrideComponent(ScanJobFlowComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('is unavailable when the andon capability is off', () => {
    andonOn = false;
    const { flow } = create();

    expect(flow.andonEnabled()).toBe(false);
    flow.showProblem();
    expect(flow.step()).toBe('actions');
  });

  it('needs a type before it sends anything', () => {
    const { flow } = create();

    flow.showProblem();
    expect(flow.step()).toBe('problem');
    expect(flow.problemType()).toBeNull();
    flow.submitProblem();

    expect(shopFloor.raiseAndon).not.toHaveBeenCalled();
    expect(flow.step()).toBe('problem');
  });

  it('raises the chosen type with the trimmed note and reports where it went', () => {
    shopFloor.raiseAndon.mockReturnValue(of({ alertId: 11, workCenterName: 'Lathe' }));
    const { flow, completed } = create();

    flow.showProblem();
    flow.selectProblemType('Stoppage');
    flow.problemNoteControl.setValue('  Spindle stalled  ');
    flow.submitProblem();

    expect(shopFloor.raiseAndon).toHaveBeenCalledWith({ jobId: 5, type: 'Stoppage', notes: 'Spindle stalled' });
    expect(flow.step()).toBe('done');
    expect(flow.problemRaisedAt()).toBe('Lathe');
    vi.advanceTimersByTime(1_500);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('sends no note when the note is blank', () => {
    shopFloor.raiseAndon.mockReturnValue(of({ alertId: 12, workCenterName: 'Mill' }));
    const { flow } = create();

    flow.showProblem();
    flow.selectProblemType('Material');
    flow.problemNoteControl.setValue('   ');
    flow.submitProblem();

    expect(shopFloor.raiseAndon).toHaveBeenCalledWith({ jobId: 5, type: 'Material', notes: null });
  });

  it('stays on the picker with the server reason when the job has no work center', () => {
    shopFloor.raiseAndon.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'JOB-0005 has no work center on its current operation.' },
    })));
    const { flow, completed } = create();

    flow.showProblem();
    flow.selectProblemType('Quality');
    flow.submitProblem();

    expect(flow.step()).toBe('problem');
    expect(flow.problemType()).toBe('Quality');
    expect(flow.error()).toBe('shopFloor.jobFlow.problem.failed:{"reason":"JOB-0005 has no work center on its current operation."}');
    vi.advanceTimersByTime(1_500);
    expect(completed).not.toHaveBeenCalled();
  });
});
