import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ShopFloorDisplayComponent } from './shop-floor-display.component';
import { KioskSessionService } from '../../shared/services/kiosk-session.service';
import { ShopFloorService } from './services/shop-floor.service';
import { ClockEventTypeService } from '../../shared/services/clock-event-type.service';
import { EventsService } from '../events/services/events.service';
import { AuthService } from '../../shared/services/auth.service';
import { ScannerService } from '../../shared/services/scanner.service';
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
    setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(),
    lastScan: () => null,
  };
  const shopFloor = {
    getOverview: vi.fn(() => of(null)),
    getClockStatus: vi.fn(() => of([])),
  };
  const events = { getUpcomingEvents: vi.fn(() => of([])) };
  const clockTypes = {
    load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false,
    isClockedOut: () => false, isActive: () => false,
  };
  const kiosk = { isTrainingMode: () => false };
  const routeMock = { snapshot: { data: {} as Record<string, unknown> } };
  const noop = {};

  function create(preview: boolean): ShopFloorDisplayComponent {
    routeMock.snapshot.data = preview ? { preview: true } : {};
    const fixture = TestBed.createComponent(ShopFloorDisplayComponent);
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem('forge-kiosk-device-token');

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
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    // Strip the heavy kiosk template so no child components need mocking.
    TestBed.overrideComponent(ShopFloorDisplayComponent, { set: { template: '', imports: [] } });
  });

  it('the REAL kiosk route unconditionally clears the inherited session on entry', () => {
    const c = create(false); // route data has no `preview`
    c.ngOnInit();
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('the preview route NEVER touches auth (no clearAuth) so the trainee stays signed in', () => {
    const c = create(true);
    c.ngOnInit();
    expect(auth.clearAuth).not.toHaveBeenCalled();
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
    selectJob: (j: unknown) => void;
    startJobTimer: (a: unknown) => void;
    stopJobTimer: (a: unknown) => void;
    confirmNextStatus: (a: unknown) => void;
    onTerminalConfigured: (t: unknown) => void;
    handleScanValue: (v: string) => void;
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
    setContext: vi.fn(), restart: vi.fn(), stop: vi.fn(), clearLastScan: vi.fn(),
    lastScan: () => null,
  };
  const shopFloor = {
    getOverview: vi.fn(() => of({ activeJobs: [], workers: [], completedToday: 0, maintenanceAlerts: 0 })),
    getClockStatus: vi.fn((_teamId?: number) => of([] as unknown[])),
    getTerminal: vi.fn(() => of(terminal)),
    clockInOut: vi.fn(() => of(undefined)),
    assignJob: vi.fn(() => of(undefined)),
    startTimer: vi.fn(() => of({})),
    stopTimer: vi.fn(() => of({})),
    completeJob: vi.fn(() => of(undefined)),
    identifyScan: vi.fn(() => of({})),
  };
  const events = { getUpcomingEvents: vi.fn(() => of([])) };
  const clockTypes = {
    load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false,
    isClockedOut: () => true, isActive: () => false,
    definitions: () => [{ code: 'IN', statusMapping: 'In', category: 'work' }],
  };
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
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

  it('a production worker clocking in without work is told to ask a lead and signed out, never shown the picker', () => {
    vi.useFakeTimers();
    const c = create();
    const worker = makeWorker('ProductionWorker');
    c.selectedWorker.set(worker);
    c.phase.set('actions');
    c.clockAction(worker, 'IN');

    expect(c.actionFeedback()?.message).toBe('shopFloor.noAssignmentAskLead');
    vi.advanceTimersByTime(2_000);
    expect(c.phase()).toBe('main');
    expect(auth.clearAuth).toHaveBeenCalled();
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

  it('a refused assignment says so with the server reason and signs the worker out', () => {
    vi.useFakeTimers();
    shopFloor.assignJob.mockReturnValueOnce(problem('Only supervisors can assign.'));
    const c = create();
    const worker = makeWorker('Manager');
    c.jobSelectWorker.set(worker);
    c.phase.set('job-select');
    c.selectJob({ id: 9, jobNumber: 'JOB-0009' });

    expect(c.actionFeedback()).toEqual({
      workerId: 5, success: false, message: 'shopFloor.assignFailed', detail: 'Only supervisors can assign.',
    });
    vi.advanceTimersByTime(2_000);
    expect(c.phase()).toBe('main');
    expect(auth.clearAuth).toHaveBeenCalled();
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
