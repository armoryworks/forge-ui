import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ShopFloorDisplayComponent } from './shop-floor-display.component';
import { KioskSessionService } from '../../shared/services/kiosk-session.service';
import { ShopFloorService } from './services/shop-floor.service';
import { ClockEventTypeService } from '../../shared/services/clock-event-type.service';
import { EventsService } from '../events/services/events.service';
import { AuthService } from '../../shared/services/auth.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { WebHidRfidService } from '../../shared/services/web-hid-rfid.service';
import { LoadingService } from '../../shared/services/loading.service';
import { PurchaseOrderService } from '../purchase-orders/services/purchase-order.service';
import { InventoryService } from '../inventory/services/inventory.service';
import { ShipmentService } from '../shipments/services/shipment.service';

/**
 * SECURITY-CRITICAL. The shop-floor kiosk is a shared terminal that wipes any
 * inherited session on entry. The training tour uses a SEPARATE `preview` child
 * route (static `data.preview = true`), so:
 *   - the real kiosk route always clears on entry — there is no runtime input
 *     (URL param, in-memory flag, storage) that can make it skip, and
 *   - the preview is inert: mock data only, no clearAuth / scanLogin / login.
 * If any of these flip, the kiosk has regressed into a session-lingering or
 * identity-switch hazard.
 */
describe('ShopFloorDisplayComponent — kiosk vs inert training preview', () => {
  const auth = {
    clearAuth: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    scanLogin: vi.fn(() => of({})),
    login: vi.fn(() => of({})),
  };
  const scanner = {
    setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(), enable: vi.fn(), disable: vi.fn(),
    lastScan: () => null,
  };
  const shopFloor = {
    getOverview: vi.fn(() => of(null)),
    getClockStatus: vi.fn(() => of([])),
    getTerminal: vi.fn(() => of({ id: 3, name: 'Bay 2', deviceToken: 'tok', teamId: 7, teamName: 'Assembly', teamColor: null })),
    getAvailableJobs: vi.fn(() => of([])),
  };
  const events = { getUpcomingEvents: vi.fn(() => of([])) };
  const clockTypes = {
    load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false,
    isClockedOut: () => false, isActive: () => false,
  };
  const kiosk = { isTrainingMode: () => false };
  const routeMock = { snapshot: { data: {} as Record<string, unknown> } };
  const router = { navigate: vi.fn() };
  const noop = {};

  function create(preview: boolean): ShopFloorDisplayComponent {
    routeMock.snapshot.data = preview ? { preview: true } : {};
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    auth.isAuthenticated.mockImplementation(() => true);
    localStorage.removeItem('forge-kiosk-device-token');
    localStorage.removeItem('forge-kiosk-terminal');

    TestBed.configureTestingModule({
      imports: [ShopFloorDisplayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: routeMock },
        { provide: KioskSessionService, useValue: kiosk },
        { provide: ScannerService, useValue: scanner },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: EventsService, useValue: events },
        { provide: ClockEventTypeService, useValue: clockTypes },
        { provide: LoadingService, useValue: noop },
        { provide: PurchaseOrderService, useValue: noop },
        { provide: InventoryService, useValue: noop },
        { provide: ShipmentService, useValue: noop },
        { provide: Router, useValue: router },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    // Strip the heavy kiosk template so no child components need mocking.
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => {
    localStorage.removeItem('forge-kiosk-device-token');
    localStorage.removeItem('forge-kiosk-terminal');
  });

  it('a paired terminal unconditionally clears the inherited session on entry', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    const c = create(false); // route data has no `preview`
    c.ngOnInit();
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('an unpaired browser with a desk session asks before turning into a terminal', () => {
    const c = create(false);
    const gate = c as unknown as { entryConfirmPending: () => boolean; continueToKiosk: () => void };
    c.ngOnInit();
    expect(gate.entryConfirmPending()).toBe(true);
    expect(auth.clearAuth).not.toHaveBeenCalled();
    expect(scanner.restart).not.toHaveBeenCalled();

    gate.continueToKiosk();
    expect(gate.entryConfirmPending()).toBe(false);
    expect(auth.clearAuth).toHaveBeenCalled();
    expect(scanner.restart).toHaveBeenCalled();
  });

  it('Back to Forge leaves the desk session signed in', () => {
    const c = create(false);
    c.ngOnInit();
    (c as unknown as { backToForge: () => void }).backToForge();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('an unpaired browser with no session goes straight to terminal setup', () => {
    auth.isAuthenticated.mockImplementation(() => false);
    const c = create(false);
    c.ngOnInit();
    expect((c as unknown as { entryConfirmPending: () => boolean }).entryConfirmPending()).toBe(false);
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('the preview route NEVER touches auth (no clearAuth) so the trainee stays signed in', () => {
    const c = create(true);
    c.ngOnInit();
    expect(auth.clearAuth).not.toHaveBeenCalled();
    expect((c as unknown as { entryConfirmPending: () => boolean }).entryConfirmPending()).toBe(false);
  });

  it('the preview route hits no backend — renders local mock data instead', () => {
    const c = create(true);
    c.ngOnInit();
    expect(shopFloor.getClockStatus).not.toHaveBeenCalled();
    expect(shopFloor.getOverview).not.toHaveBeenCalled();
    // Representative cards exist for the tour to highlight.
    expect((c as unknown as { workers: () => unknown[] }).workers().length).toBeGreaterThan(0);
  });

  it('SECURITY: tapping a card in preview performs no real sign-in (no identity switch)', () => {
    const c = create(true);
    c.ngOnInit();
    const worker = (c as unknown as { workers: () => { userId: number }[] }).workers()[0];
    (c as unknown as { selectWorker: (w: unknown) => void }).selectWorker(worker);
    // And a defensive direct PIN submit is also a no-op.
    (c as unknown as { onPinSubmit: () => void }).onPinSubmit();
    expect(auth.scanLogin).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });
});

describe('ShopFloorDisplayComponent — kiosk actions', () => {
  type Feedback = { workerId: number; success: boolean; message: string; detail: string | null } | null;
  interface Internals {
    selectedWorker: { (): { userId: number } | null; set: (w: unknown) => void };
    jobSelectWorker: { set: (w: unknown) => void };
    phase: { (): string; set: (p: string) => void };
    actionFeedback: () => Feedback;
    canSupervise: () => boolean;
    terminal: () => { teamId: number; teamName: string } | null;
    fontSize: () => number;
    maxFontSizeIndex: number;
    clockAction: (w: unknown, code: string) => void;
    claimJob: (j: unknown) => void;
    openPickerFromActions: () => void;
    showMoreJobs: () => void;
    pickerSearch: { setValue: (v: string) => void };
    enterAssignMode: () => void;
    toggleAssignSelection: (j: unknown) => void;
    onWorkerTile: (w: unknown) => void;
    finishAssign: () => void;
    skipJobSelect: () => void;
    cancelPin: () => void;
    workers: { set: (w: unknown[]) => void };
    sortedWorkers: () => { name: string }[];
    tileMinWidth: () => number;
    denseBoard: () => boolean;
    timerElapsed: () => Record<string, string>;
    shiftTimes: () => Record<number, string>;
    runningJobTimes: () => Record<number, string>;
    runningJobNumber: (w: unknown) => string | null;
    onPinKeydown: (e: KeyboardEvent) => void;
    authenticating: () => boolean;
    readyToStart: () => number;
    boardJobs: () => unknown[];
    boardJobTotal: () => number;
    updateClock: () => void;
    isPastDue: (j: unknown) => boolean;
    startJobTimer: (a: unknown) => void;
    stopJobTimer: (a: unknown) => void;
    confirmNextStatus: (a: unknown) => void;
    onTerminalConfigured: (t: unknown) => void;
    handleScanValue: (v: string) => void;
    cancelActions: () => void;
    onPinSubmit: () => void;
    pinControl: { setValue: (v: string) => void };
    scanFeedback: () => string | null;
  }

  const terminal = { id: 3, name: 'Bay 2', deviceToken: 'tok', teamId: 7, teamName: 'Assembly', teamColor: null };
  const assignment = {
    jobId: 41, jobNumber: 'JOB-0041', title: 'Bracket', priorityName: 'High',
    stageName: 'In Production', stageColor: '#000', isOverdue: false, hasActiveTimer: false,
  };
  const makeWorker = (role: string, assignments: unknown[] = []) => ({
    userId: 5, name: 'Pat Doe', email: 'p@x.test', initials: 'PD', avatarColor: '#000', isClockedIn: false,
    clockedInAt: null, status: 'Out', currentTask: null, currentJobNumber: null, timeOnTask: '',
    statusSince: null, role, assignments,
  });
  const problem = (detail: string) => throwError(() => new HttpErrorResponse({ status: 400, error: { detail } }));

  const auth = { clearAuth: vi.fn(), isAuthenticated: vi.fn(() => false), scanLogin: vi.fn(), login: vi.fn() };
  const scanner = {
    setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(), enable: vi.fn(), disable: vi.fn(),
    lastScan: () => null,
  };
  const availableJob = {
    jobId: 2403, jobNumber: 'J-2403', title: 'Bracket run', partNumber: 'BR-100', quantity: 50, dueDate: '2026-10-10',
    priorityName: 'Normal', stageName: 'In Production',
    nextOperation: { operationId: 81, stepNumber: 20, title: 'Deburr', workCenterId: 4, workCenterName: 'Bench 1' },
  };
  const shopFloor = {
    getOverview: vi.fn(() => of({ activeJobs: [], workers: [], completedToday: 0, maintenanceAlerts: 0 })),
    getClockStatus: vi.fn((_teamId?: number) => of([] as unknown[])),
    getTerminal: vi.fn(() => of(terminal)),
    clockInOut: vi.fn(() => of(undefined)),
    assignJob: vi.fn(() => of(undefined)),
    getAvailableJobs: vi.fn((_teamId?: number, _search?: string, _take?: number) => of([] as unknown[])),
    claimJob: vi.fn(() => of(undefined)),
    startTimer: vi.fn(() => of({})),
    stopTimer: vi.fn((_target?: unknown) => of({})),
    completeJob: vi.fn(() => of(undefined)),
    identifyScan: vi.fn(() => of({})),
    getConfig: vi.fn(() => of({ operationTracking: false })),
  };
  const events = { getUpcomingEvents: vi.fn(() => of([])) };
  const clockTypes = {
    load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false,
    isClockedOut: () => true, isActive: () => false,
    definitions: () => [{ code: 'IN', statusMapping: 'In', category: 'work' }],
  };
  const dialogClose = vi.fn();
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true), close: dialogClose })) };
  const loading = { track: (_label: string, obs: unknown) => obs };
  const translate = {
    instant: (k: string, p?: Record<string, unknown>) => (p ? `${k} ${JSON.stringify(p)}` : k),
  };
  const noop = {};

  function create(): Internals {
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    return fixture.componentInstance as unknown as Internals;
  }

  function init(c: Internals): void {
    (c as unknown as { ngOnInit: () => void }).ngOnInit();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('forge-kiosk-device-token');
    localStorage.removeItem('forge-kiosk-terminal');
    localStorage.removeItem('sf-font-index');

    TestBed.configureTestingModule({
      imports: [ShopFloorDisplayComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        { provide: KioskSessionService, useValue: { isTrainingMode: () => false } },
        { provide: ScannerService, useValue: scanner },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: EventsService, useValue: events },
        { provide: ClockEventTypeService, useValue: clockTypes },
        { provide: LoadingService, useValue: loading },
        { provide: PurchaseOrderService, useValue: noop },
        { provide: InventoryService, useValue: noop },
        { provide: ShipmentService, useValue: noop },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: translate },
      ],
    });
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('only Admin and Manager can supervise (move status, pick work)', () => {
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker'));
    expect(c.canSupervise()).toBe(false);
    c.selectedWorker.set(makeWorker('OfficeManager'));
    expect(c.canSupervise()).toBe(false);
    c.selectedWorker.set(makeWorker('Manager'));
    expect(c.canSupervise()).toBe(true);
    c.selectedWorker.set(makeWorker('Admin'));
    expect(c.canSupervise()).toBe(true);
  });

  it('a production worker cannot move a work order to the next status', () => {
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker', [assignment]));
    c.confirmNextStatus(assignment);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(shopFloor.completeJob).not.toHaveBeenCalled();
  });

  it('a supervisor confirms before the work order moves, then sees the result for 2 s before sign-out', () => {
    vi.useFakeTimers();
    const c = create();
    c.selectedWorker.set(makeWorker('Manager', [assignment]));
    c.phase.set('actions');
    c.confirmNextStatus(assignment);

    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(shopFloor.completeJob).toHaveBeenCalledWith(41);
    expect(c.actionFeedback()?.message).toBe('shopFloor.movedNext {"jobNumber":"JOB-0041"}');

    vi.advanceTimersByTime(1_900);
    expect(c.phase()).toBe('actions');
    vi.advanceTimersByTime(200);
    expect(c.phase()).toBe('main');
  });

  it('a failed move shows the server reason', () => {
    shopFloor.completeJob.mockReturnValueOnce(problem('The next status, Invoiced, is an office status.'));
    const c = create();
    c.selectedWorker.set(makeWorker('Admin', [assignment]));
    c.confirmNextStatus(assignment);
    const fb = c.actionFeedback();
    expect(fb?.success).toBe(false);
    expect(fb?.message).toContain('shopFloor.moveFailed');
    expect(fb?.message).toContain('The next status, Invoiced, is an office status.');
  });

  it('a production worker clocking in without work gets the job picker to take one', () => {
    vi.useFakeTimers();
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    c.phase.set('actions');
    c.clockAction(worker, 'IN');

    vi.advanceTimersByTime(800);
    expect(c.phase()).toBe('job-select');
    expect(shopFloor.getAvailableJobs).toHaveBeenCalledWith(undefined, '', 50);
  });

  it('a worker finds J-2403 by typing in the picker and claims it', () => {
    vi.useFakeTimers();
    shopFloor.getAvailableJobs.mockImplementation(() => of([availableJob]));
    try {
      const c = create();
      const worker = makeWorker('ProductionWorker');
      c.selectedWorker.set(worker);
      c.phase.set('actions');
      c.openPickerFromActions();
      expect(c.phase()).toBe('job-select');

      c.pickerSearch.setValue('2403');
      expect(shopFloor.getAvailableJobs).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(250);
      expect(shopFloor.getAvailableJobs).toHaveBeenLastCalledWith(undefined, '2403', 50);

      c.claimJob(availableJob);
      expect(shopFloor.claimJob).toHaveBeenCalledWith(2403);
      expect(shopFloor.assignJob).not.toHaveBeenCalled();
      expect(c.phase()).toBe('actions');
      expect(c.actionFeedback()?.message).toBe('kioskDisplay.claimed {"jobNumber":"J-2403"}');
    } finally {
      shopFloor.getAvailableJobs.mockImplementation(() => of([]));
    }
  });

  it('the picker loads 50 jobs at a time', () => {
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker'));
    c.phase.set('actions');
    c.openPickerFromActions();
    expect(shopFloor.getAvailableJobs).toHaveBeenLastCalledWith(undefined, '', 50);
    c.showMoreJobs();
    expect(shopFloor.getAvailableJobs).toHaveBeenLastCalledWith(undefined, '', 100);
  });

  it('a supervisor clocking in without work gets the work order picker', () => {
    vi.useFakeTimers();
    const c = create();
    const worker = makeWorker('Manager');
    c.selectedWorker.set(worker);
    c.phase.set('actions');
    c.clockAction(worker, 'IN');
    vi.advanceTimersByTime(800);
    expect(c.phase()).toBe('job-select');
  });

  it('a failed punch keeps the failure and the server reason on the card', () => {
    shopFloor.clockInOut.mockReturnValueOnce(problem('Not your badge.'));
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    c.clockAction(worker, 'IN');
    expect(c.actionFeedback()).toEqual({
      workerId: 5, success: false, message: 'shopFloor.actionFailed', detail: 'Not your badge.',
    });
  });

  it('a refused claim shows the server reason and keeps the picker open with a fresh list', () => {
    shopFloor.claimJob.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'J-0009 is already assigned.' } })));
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.jobSelectWorker.set(worker);
    c.phase.set('job-select');
    c.claimJob({ ...availableJob, jobId: 9, jobNumber: 'J-0009' });

    expect(c.actionFeedback()).toEqual({
      workerId: 5, success: false, message: 'kioskDisplay.claimFailed {"jobNumber":"J-0009"}', detail: 'J-0009 is already assigned.',
    });
    expect(c.phase()).toBe('job-select');
    expect(shopFloor.getAvailableJobs).toHaveBeenCalled();
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('a supervisor taps a work order, then a worker tile, to assign it', () => {
    const c = create();
    const supervisor = { ...makeWorker('Manager'), userId: 20 };
    const worker = { ...makeWorker('ProductionWorker'), name: 'Pat Doe' };
    c.selectedWorker.set(supervisor);
    c.phase.set('actions');
    c.enterAssignMode();
    expect(c.phase()).toBe('assign');

    c.onWorkerTile(worker);
    expect(shopFloor.assignJob).not.toHaveBeenCalled();
    expect(c.actionFeedback()?.message).toBe('kioskDisplay.assignPickJobFirst');

    c.toggleAssignSelection(availableJob);
    c.onWorkerTile(worker);
    expect(shopFloor.assignJob).toHaveBeenCalledWith(2403, 5);
    expect(c.actionFeedback()?.message).toBe('kioskDisplay.assignedTo {"jobNumber":"J-2403","name":"Pat Doe"}');
    expect(c.phase()).toBe('assign');

    c.finishAssign();
    expect(c.phase()).toBe('main');
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('a production worker cannot switch the board into assign mode', () => {
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker'));
    c.phase.set('actions');
    c.enterAssignMode();
    expect(c.phase()).toBe('actions');
  });

  it('tapping a tile outside assign mode asks that worker to sign in', () => {
    const c = create();
    c.onWorkerTile(makeWorker('ProductionWorker'));
    expect(c.phase()).toBe('pin');
    expect(shopFloor.assignJob).not.toHaveBeenCalled();
  });

  it('worker tiles keep alphabetical order whatever their clock status', () => {
    const c = create();
    c.workers.set([
      { ...makeWorker('ProductionWorker'), userId: 1, name: 'Zed Young', status: 'In' },
      { ...makeWorker('ProductionWorker'), userId: 2, name: 'Amy Allen', status: 'Out' },
      { ...makeWorker('ProductionWorker'), userId: 3, name: 'Bo Burke', status: 'In' },
    ]);
    expect(c.sortedWorkers().map(w => w.name)).toEqual(['Amy Allen', 'Bo Burke', 'Zed Young']);
  });

  it('tiles get smaller as the team grows so thirty people fit on one screen', () => {
    const c = create();
    const team = (n: number) => Array.from({ length: n }, (_, i) => ({ ...makeWorker('ProductionWorker'), userId: i + 1, name: `W${i}` }));
    c.workers.set(team(10));
    expect(c.tileMinWidth()).toBe(300);
    expect(c.denseBoard()).toBe(false);
    c.workers.set(team(15));
    expect(c.tileMinWidth()).toBe(240);
    c.workers.set(team(30));
    expect(c.tileMinWidth()).toBe(200);
    expect(c.denseBoard()).toBe(true);
  });

  it('a running timer counts up from when it started, and the shift from clock-in', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const working = vi.spyOn(clockTypes, 'isWorking').mockReturnValue(true);
    try {
      const c = create();
      c.workers.set([{
        ...makeWorker('ProductionWorker', [{ ...assignment, hasActiveTimer: true, timerStartedAt: '2026-10-08T11:58:55Z' }]),
        status: 'In', clockedInAt: '2026-10-08T10:55:00Z',
      }]);
      expect(c.timerElapsed()['5:41']).toBe('1m 05s');
      expect(c.runningJobTimes()[5]).toBe('1m 05s');
      expect(c.shiftTimes()[5]).toBe('1h 05m 00s');
      vi.setSystemTime(new Date('2026-10-08T12:00:01Z'));
      c.updateClock();
      expect(c.timerElapsed()['5:41']).toBe('1m 06s');
      expect(c.runningJobTimes()[5]).toBe('1m 06s');
      expect(c.shiftTimes()[5]).toBe('1h 05m 01s');
    } finally {
      working.mockRestore();
    }
  });

  it('a timer started by scanning a traveler for a job nobody assigned still reads as running and counts up', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T12:00:00Z'));
    const working = vi.spyOn(clockTypes, 'isWorking').mockReturnValue(true);
    try {
      const c = create();
      const scanned = {
        ...makeWorker('ProductionWorker'),
        status: 'In', clockedInAt: '2026-10-08T10:55:00Z',
        currentJobNumber: 'J-2403', statusSince: '2026-10-08T11:30:00Z',
      };
      c.workers.set([scanned]);
      expect(c.runningJobNumber(scanned)).toBe('J-2403');
      expect(c.runningJobTimes()[5]).toBe('30m 00s');
      vi.setSystemTime(new Date('2026-10-08T12:00:01Z'));
      c.updateClock();
      expect(c.runningJobTimes()[5]).toBe('30m 01s');

      const idle = { ...scanned, currentJobNumber: null };
      c.workers.set([idle]);
      expect(c.runningJobNumber(idle)).toBeNull();
      expect(c.runningJobTimes()[5]).toBeUndefined();
    } finally {
      working.mockRestore();
    }
  });

  it('Escape during a sign-in in flight leaves the PIN pad until the sign-in settles', () => {
    const signIn = new Subject<unknown>();
    auth.scanLogin.mockReturnValueOnce(signIn);
    const c = create();
    c.onWorkerTile(makeWorker('ProductionWorker'));
    (c as unknown as { scannedValue: { set: (v: string) => void } }).scannedValue.set('BADGE-5');
    c.pinControl.setValue('1234');
    c.onPinSubmit();
    expect(c.authenticating()).toBe(true);
    c.cancelPin();
    c.onPinSubmit();
    expect(c.phase()).toBe('pin');
    expect(auth.scanLogin).toHaveBeenCalledTimes(1);
    signIn.next({});
    signIn.complete();
    expect(c.phase()).toBe('actions');
    expect(c.selectedWorker()?.userId).toBe(5);
  });

  it('a second badge scanned into the PIN pad signs that badge in instead of submitting it as a PIN', () => {
    vi.useFakeTimers();
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 6 }));
    const c = create();
    const next = { ...makeWorker('ProductionWorker'), userId: 6, name: 'Sam Roe' };
    c.workers.set([makeWorker('ProductionWorker'), next]);
    c.onWorkerTile(makeWorker('ProductionWorker'));
    expect(c.phase()).toBe('pin');
    for (const key of 'BADGE0006') {
      c.onPinKeydown(new KeyboardEvent('keydown', { key }));
      vi.advanceTimersByTime(10);
    }
    c.onPinKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.scanLogin).not.toHaveBeenCalled();
    expect(shopFloor.identifyScan).toHaveBeenCalledWith('BADGE0006');
    expect(c.phase()).toBe('pin');
    expect(c.selectedWorker()?.userId).toBe(6);
  });

  it('a PIN typed by hand still submits on Enter', () => {
    vi.useFakeTimers();
    auth.login.mockReturnValueOnce(of({}));
    const c = create();
    c.onWorkerTile(makeWorker('ProductionWorker'));
    for (const key of 'secret') {
      c.onPinKeydown(new KeyboardEvent('keydown', { key }));
      vi.advanceTimersByTime(120);
    }
    c.pinControl.setValue('secret');
    c.onPinKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(auth.login).toHaveBeenCalledWith({ email: 'p@x.test', password: 'secret' });
    expect(shopFloor.identifyScan).not.toHaveBeenCalled();
  });

  it('the header counts work that is ready to start, and the board lists the open jobs', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    shopFloor.getOverview.mockReturnValueOnce(of({ activeJobs: [], workers: [], completedToday: 0, maintenanceAlerts: 0, readyToStartCount: 3 }));
    shopFloor.getAvailableJobs.mockReturnValueOnce(of([availableJob]));
    const c = create();
    init(c);
    expect(c.readyToStart()).toBe(3);
    expect(shopFloor.getAvailableJobs).toHaveBeenCalledWith(7, '', 50);
    expect(c.boardJobs()).toEqual([availableJob]);
  });

  it('a job reads as overdue only once its due date has passed, by the same calendar day the server uses', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
    const c = create();
    expect(c.isPastDue({ ...availableJob, dueDate: '2026-10-07T00:00:00Z' })).toBe(true);
    expect(c.isPastDue({ ...availableJob, dueDate: '2026-10-08T00:00:00Z' })).toBe(false);
    expect(c.isPastDue({ ...availableJob, dueDate: '2026-10-09T00:00:00Z' })).toBe(false);
    expect(c.isPastDue({ ...availableJob, dueDate: null })).toBe(false);
  });

  it('the badge scanner pauses while the PIN pad or the job picker is open', () => {
    const c = create();
    init(c);
    c.phase.set('pin');
    TestBed.tick();
    expect(scanner.disable).toHaveBeenCalled();
    c.phase.set('main');
    TestBed.tick();
    expect(scanner.enable).toHaveBeenCalled();
  });

  it('focus returns to the search area, not into its text box, after the PIN dialog closes', () => {
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    const host = fixture.nativeElement as HTMLElement;
    const searchArea = document.createElement('app-kiosk-search-bar');
    searchArea.className = 'sf-header__search';
    searchArea.tabIndex = -1;
    const searchInput = document.createElement('input');
    searchInput.className = 'kiosk-search__input';
    searchArea.appendChild(searchInput);
    host.appendChild(searchArea);
    document.body.appendChild(host);
    try {
      const c = fixture.componentInstance as unknown as Internals;
      c.onWorkerTile(makeWorker('ProductionWorker'));
      c.cancelPin();
      expect(document.activeElement).not.toBe(searchArea);
      TestBed.tick();
      expect(document.activeElement).toBe(searchArea);
    } finally {
      host.remove();
    }
  });

  it('a badge scanned right after a dialog closes still signs the next worker in', () => {
    const rfid = { lastScan: signal(null), clearLastScan: vi.fn(), reconnect: vi.fn().mockResolvedValue(false), disconnect: vi.fn() };
    TestBed.overrideProvider(WebHidRfidService, { useValue: rfid });
    TestBed.overrideProvider(ScannerService, { useFactory: () => new ScannerService() });
    vi.useFakeTimers();
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const worker = makeWorker('ProductionWorker');
    shopFloor.getClockStatus.mockImplementation(() => of([worker]));
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 5 }));

    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    const host = fixture.nativeElement as HTMLElement;
    const searchArea = document.createElement('app-kiosk-search-bar');
    searchArea.className = 'sf-header__search';
    searchArea.tabIndex = -1;
    host.appendChild(searchArea);
    document.body.appendChild(host);
    try {
      const c = fixture.componentInstance as unknown as Internals;
      init(c);
      c.onWorkerTile(worker);
      TestBed.tick();
      c.cancelPin();
      TestBed.tick();
      expect(document.activeElement).toBe(searchArea);

      for (const key of '12345678') {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        vi.advanceTimersByTime(10);
      }
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      TestBed.tick();

      expect(shopFloor.identifyScan).toHaveBeenCalledWith('12345678');
      expect(c.phase()).toBe('pin');
    } finally {
      host.remove();
      shopFloor.getClockStatus.mockImplementation(() => of([]));
    }
  });

  it('skipping the picker while a claim is in flight waits for the claim', () => {
    const claim = new Subject<undefined>();
    shopFloor.claimJob.mockReturnValueOnce(claim);
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    c.jobSelectWorker.set(worker);
    c.phase.set('job-select');
    c.claimJob(availableJob);
    c.skipJobSelect();
    expect(c.phase()).toBe('job-select');
    expect(auth.clearAuth).not.toHaveBeenCalled();
    claim.next(undefined);
    claim.complete();
    expect(c.phase()).toBe('actions');
    expect(c.selectedWorker()?.userId).toBe(5);
  });

  it('a claim that lands after the worker was signed out does not reopen an empty actions card', () => {
    const claim = new Subject<undefined>();
    shopFloor.claimJob.mockReturnValueOnce(claim);
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    c.jobSelectWorker.set(worker);
    c.phase.set('job-select');
    c.claimJob(availableJob);
    c.selectedWorker.set(null);
    c.jobSelectWorker.set(null);
    c.phase.set('main');
    claim.next(undefined);
    claim.complete();
    expect(c.phase()).toBe('main');
  });

  it('the board count is the full ready-to-start total even when only the first 50 are shown', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    shopFloor.getOverview.mockReturnValueOnce(of({ activeJobs: [], workers: [], completedToday: 0, maintenanceAlerts: 0, readyToStartCount: 120 }));
    shopFloor.getAvailableJobs.mockReturnValueOnce(of([availableJob]));
    const c = create();
    init(c);
    expect(c.boardJobs().length).toBe(1);
    expect(c.boardJobTotal()).toBe(120);
  });

  it('a failed timer start shows the server reason in the actions card', () => {
    shopFloor.startTimer.mockReturnValueOnce(problem('Clock in first.'));
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker', [assignment]));
    c.startJobTimer(assignment);
    const fb = c.actionFeedback();
    expect(fb?.success).toBe(false);
    expect(fb?.message).toBe('shopFloor.timerStartFailed {"jobNumber":"JOB-0041","reason":"Clock in first."}');
  });

  it('a proxy error page or an oversized body never reaches the screen', () => {
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    shopFloor.clockInOut.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 502, error: '<html><body>Bad Gateway</body></html>' })));
    c.clockAction(worker, 'IN');
    expect(c.actionFeedback()?.detail).toBe('errors.serverError {"status":502}');
    shopFloor.clockInOut.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: 'x'.repeat(201) })));
    c.clockAction(worker, 'IN');
    expect(c.actionFeedback()?.detail).toBe('errors.serverError {"status":500}');
    shopFloor.clockInOut.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: 'Already clocked in.' })));
    c.clockAction(worker, 'IN');
    expect(c.actionFeedback()?.detail).toBe('Already clocked in.');
  });

  it('closes an open next-status dialog when the session resets', () => {
    dialog.open.mockReturnValueOnce({ afterClosed: () => NEVER, close: dialogClose });
    const c = create();
    c.selectedWorker.set(makeWorker('Manager', [assignment]));
    c.phase.set('actions');
    c.confirmNextStatus(assignment);
    expect(dialogClose).not.toHaveBeenCalled();
    c.cancelActions();
    expect(dialogClose).toHaveBeenCalled();
    expect(shopFloor.completeJob).not.toHaveBeenCalled();
  });

  it('a manager from another team can badge in on a team display and move work', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const teammate = { ...makeWorker('ProductionWorker'), userId: 6 };
    const manager = { ...makeWorker('Manager', [assignment]), userId: 20 };
    shopFloor.getClockStatus.mockImplementation((teamId?: number) => of(teamId ? [teammate] : [teammate, manager]));
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 20 }));
    auth.scanLogin.mockReturnValueOnce(of({}));
    try {
      const c = create();
      init(c);
      c.handleScanValue('BADGE-20');
      expect(c.phase()).toBe('pin');
      c.pinControl.setValue('1234');
      c.onPinSubmit();
      expect(c.phase()).toBe('actions');
      expect(c.selectedWorker()?.userId).toBe(20);
      expect(c.canSupervise()).toBe(true);
      expect(shopFloor.getClockStatus).toHaveBeenLastCalledWith();
      c.confirmNextStatus(assignment);
      expect(shopFloor.completeJob).toHaveBeenCalledWith(41);
    } finally {
      shopFloor.getClockStatus.mockImplementation(() => of([]));
    }
  });

  it('an off-team production worker is told they are not on this team', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const outsider = { ...makeWorker('ProductionWorker'), userId: 30 };
    shopFloor.getClockStatus.mockImplementation((teamId?: number) => of(teamId ? [] : [outsider]));
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 30 }));
    try {
      const c = create();
      init(c);
      c.handleScanValue('BADGE-30');
      expect(c.phase()).toBe('main');
      expect(c.scanFeedback()).toBe('shopFloor.display.employeeNotOnTeam');
    } finally {
      shopFloor.getClockStatus.mockImplementation(() => of([]));
    }
  });

  it('timer start and stop confirm with the work order number', () => {
    const c = create();
    c.selectedWorker.set(makeWorker('ProductionWorker', [assignment]));
    c.startJobTimer(assignment);
    expect(c.actionFeedback()?.message).toBe('shopFloor.timerStartedOn {"jobNumber":"JOB-0041"}');
    c.stopJobTimer(assignment);
    expect(c.actionFeedback()?.message).toBe('shopFloor.timerStoppedOn {"jobNumber":"JOB-0041"}');
  });

  it('with operation tracking off, the card Stop sends today\'s empty stop after badge-in', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const worker = makeWorker('ProductionWorker', [{ ...assignment, hasActiveTimer: true }]);
    shopFloor.getClockStatus.mockImplementation(() => of([worker]));
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 5 }));
    auth.scanLogin.mockReturnValueOnce(of({}));
    try {
      const c = create();
      init(c);
      c.handleScanValue('BADGE-5');
      c.pinControl.setValue('1234');
      c.onPinSubmit();
      expect(shopFloor.getConfig).toHaveBeenCalledTimes(1);
      c.stopJobTimer(assignment);
      expect(shopFloor.stopTimer.mock.calls[0]).toEqual([]);
    } finally {
      shopFloor.getClockStatus.mockImplementation(() => of([]));
    }
  });

  it('with operation tracking on, the card Stop names the work order', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const worker = makeWorker('ProductionWorker', [{ ...assignment, hasActiveTimer: true }]);
    shopFloor.getClockStatus.mockImplementation(() => of([worker]));
    shopFloor.identifyScan.mockReturnValueOnce(of({ scanType: 'employee', entityId: 5 }));
    shopFloor.getConfig.mockReturnValueOnce(of({ operationTracking: true }));
    auth.scanLogin.mockReturnValueOnce(of({}));
    try {
      const c = create();
      init(c);
      c.handleScanValue('BADGE-5');
      c.pinControl.setValue('1234');
      c.onPinSubmit();
      c.stopJobTimer(assignment);
      expect(shopFloor.stopTimer).toHaveBeenCalledWith({ jobId: 41 });

      c.cancelActions();
      c.selectedWorker.set(worker);
      c.stopJobTimer(assignment);
      expect(shopFloor.stopTimer.mock.calls[1]).toEqual([]);
    } finally {
      shopFloor.getClockStatus.mockImplementation(() => of([]));
    }
  });

  it('an unidentified scan asks for a PIN with no leftover worker and times out', () => {
    vi.useFakeTimers();
    shopFloor.identifyScan.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const c = create();
    c.selectedWorker.set(makeWorker('Admin'));
    c.handleScanValue('BADGE-1');
    expect(c.phase()).toBe('pin');
    expect((c as unknown as { selectedWorker: () => unknown }).selectedWorker()).toBeNull();
    vi.advanceTimersByTime(20_000);
    expect(c.phase()).toBe('main');
  });

  it('a paired display loads only its own team', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
    const c = create();
    init(c);
    expect(shopFloor.getTerminal).toHaveBeenCalledWith('tok');
    expect(shopFloor.getOverview).toHaveBeenCalledWith(7);
    expect(shopFloor.getClockStatus).toHaveBeenCalledWith(7);
    expect(c.terminal()?.teamName).toBe('Assembly');
  });

  it('a paired display with no cached terminal waits for the terminal before loading', () => {
    localStorage.setItem('forge-kiosk-device-token', 'tok');
    const c = create();
    init(c);
    expect(shopFloor.getOverview).toHaveBeenCalledTimes(1);
    expect(shopFloor.getOverview).toHaveBeenCalledWith(7);
    expect(JSON.parse(localStorage.getItem('forge-kiosk-terminal') ?? 'null')?.teamId).toBe(7);
  });

  it('a newly configured terminal scopes the board to the chosen team', () => {
    const c = create();
    c.onTerminalConfigured({ ...terminal, teamId: 12, teamName: 'Paint' });
    expect(shopFloor.getOverview).toHaveBeenCalledWith(12);
    expect(shopFloor.getClockStatus).toHaveBeenCalledWith(12);
  });

  it('keeps the screen awake while paired and lets go on destroy', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ released: false, release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    try {
      localStorage.setItem('forge-kiosk-device-token', 'tok');
      localStorage.setItem('forge-kiosk-terminal', JSON.stringify(terminal));
      const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
      (fixture.componentInstance as unknown as { ngOnInit: () => void }).ngOnInit();
      expect(request).toHaveBeenCalledWith('screen');
      await Promise.resolve();
      fixture.destroy();
      expect(release).toHaveBeenCalled();
    } finally {
      delete (navigator as unknown as Record<string, unknown>)['wakeLock'];
    }
  });

  it('offers bigger text sizes and applies the saved size before the first render', () => {
    localStorage.setItem('sf-font-index', '6');
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    const c = fixture.componentInstance as unknown as Internals;
    expect(c.maxFontSizeIndex).toBe(6);
    expect(c.fontSize()).toBe(28);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--sf-zoom')).toBe(`${28 / 12}`);
  });
});
