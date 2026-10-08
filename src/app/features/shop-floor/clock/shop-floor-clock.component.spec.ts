import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ShopFloorClockComponent } from './shop-floor-clock.component';
import { ShopFloorService } from '../services/shop-floor.service';
import { AuthService, AuthUser } from '../../../shared/services/auth.service';
import { ClockEventTypeDef, ClockEventTypeService } from '../../../shared/services/clock-event-type.service';
import { WebHidRfidService } from '../../../shared/services/web-hid-rfid.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { ClockWorker } from '../models/clock-worker.model';

interface ClockInternals {
  workers: { set(v: ClockWorker[]): void };
  kioskPhase: () => string;
  selfWorker: () => ClockWorker | null;
  otherWorkers: () => ClockWorker[];
  notSetUpForWorker: () => boolean;
  punchError: () => { detail: string } | null;
  punchRecorded: () => string | null;
  punchUndoMessage: () => string | null;
  punchUndoState: () => string | null;
  clockAction(worker: ClockWorker, action: ClockEventTypeDef): void;
  undoPunch(): void;
  enterClockPhase(): void;
}

function worker(userId: number, name: string): ClockWorker {
  return {
    userId, name, email: `${name}@forge.local`, initials: name[0], avatarColor: '#000',
    isClockedIn: false, clockedInAt: null, status: 'Out', currentTask: null, currentJobNumber: null,
    timeOnTask: '', statusSince: null, assignments: [], role: 'ProductionWorker',
  };
}

const clockIn: ClockEventTypeDef = {
  code: 'ClockIn', label: 'Clock In', statusMapping: 'In', oppositeCode: 'ClockOut', category: 'work',
  countsAsActive: true, isMismatchable: false, icon: 'login', color: '#0f0',
};

describe('ShopFloorClockComponent — clock phase', () => {
  const user = signal<AuthUser | null>(null);
  const token = signal<string | null>(null);
  const auth = { user, token, clearAuth: vi.fn(), scanLogin: vi.fn(), login: vi.fn() };
  const mobileApi = {
    clockState: vi.fn(() => of({ state: 'in', lastEventType: 'ClockIn', lastEventAt: null, lastEventId: 501 })),
    undoClockPunch: vi.fn(() => of({ state: 'out', lastEventType: null, lastEventAt: null, lastEventId: null })),
  };
  const shopFloor = {
    getClockStatus: vi.fn(() => of([])),
    getOverview: vi.fn(() => of(null)),
    getTerminal: vi.fn(),
    clockInOut: vi.fn(),
  };
  const rfid = { lastScan: () => null, clearLastScan: vi.fn(), reconnect: vi.fn(), disconnect: vi.fn() };
  const clockTypes = { load: vi.fn(), isWorking: () => false, isOnBreakOrLunch: () => false, isClockedOut: () => true };

  function signIn(id: number, roles: string[]): void {
    user.set({ id, email: 'x@forge.local', firstName: 'X', lastName: 'Y', initials: 'XY', avatarColor: null, roles, profileComplete: true });
    token.set(`token-${id}`);
  }

  function create(): ClockInternals {
    const fixture = TestBed.createComponent(ShopFloorClockComponent);
    fixture.detectChanges();
    auth.clearAuth.mockClear();
    const c = fixture.componentInstance as unknown as ClockInternals;
    c.workers.set([worker(1, 'Ana'), worker(2, 'Ben')]);
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    user.set(null);
    token.set(null);
    shopFloor.getClockStatus.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      imports: [ShopFloorClockComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ShopFloorService, useValue: shopFloor },
        { provide: WebHidRfidService, useValue: rfid },
        { provide: MobileApiService, useValue: mobileApi },
        { provide: ClockEventTypeService, useValue: clockTypes },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (k: string, p?: Record<string, string>) => p ? `${k}:${JSON.stringify(p)}` : k } },
      ],
    });
    TestBed.overrideComponent(ShopFloorClockComponent, { set: { template: '', imports: [] } });
  });

  afterEach(() => vi.useRealTimers());

  it('a worker sees only their own punch actions', () => {
    signIn(1, ['ProductionWorker']);
    const c = create();
    expect(c.selfWorker()?.userId).toBe(1);
    expect(c.otherWorkers()).toEqual([]);
  });

  it('a manager also sees the other workers for a supervisor punch', () => {
    signIn(1, ['Manager']);
    const c = create();
    expect(c.selfWorker()?.userId).toBe(1);
    expect(c.otherWorkers().map(w => w.userId)).toEqual([2]);
  });

  it('a worker who is not on this terminal\'s team is told so instead of seeing no buttons', () => {
    signIn(9, ['ProductionWorker']);
    const c = create();
    expect(c.selfWorker()).toBeNull();
    expect(c.otherWorkers()).toEqual([]);
    expect(c.notSetUpForWorker()).toBe(true);
  });

  it('a worker on this terminal\'s team gets no not-set-up message', () => {
    signIn(1, ['ProductionWorker']);
    const c = create();
    expect(c.notSetUpForWorker()).toBe(false);
  });

  it('a failed punch keeps the worker on the clock screen with the server reason', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 409, error: { detail: 'Already clocked in.' } })));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);

    expect(c.kioskPhase()).toBe('clock');
    expect(c.punchError()).toEqual({ detail: 'Already clocked in.' });
    expect(auth.clearAuth).not.toHaveBeenCalled();
  });

  it('a recorded punch is shown for two seconds before signing out', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);

    expect(c.punchRecorded()).toContain('shopFloor.punchRecorded');
    expect(c.kioskPhase()).toBe('clock');
    vi.advanceTimersByTime(1999);
    expect(c.kioskPhase()).toBe('clock');
    vi.advanceTimersByTime(1);
    expect(c.kioskPhase()).toBe('dashboard');
    expect(auth.clearAuth).toHaveBeenCalled();
  });

  it('offers undo of the worker\'s own punch for ten seconds, sent with their token after sign-out', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);

    expect(c.punchUndoState()).toBe('offered');
    expect(c.punchUndoMessage()).toContain('kioskSetup.punchUndo.offer');
    vi.advanceTimersByTime(2000);
    expect(c.kioskPhase()).toBe('dashboard');
    token.set(null);
    expect(c.punchUndoState()).toBe('offered');

    c.undoPunch();

    expect(mobileApi.undoClockPunch).toHaveBeenCalledWith(501, 'token-1');
    expect(c.punchUndoState()).toBe('undone');
    expect(c.punchUndoMessage()).toBe('kioskSetup.punchUndo.undone');
  });

  it('withdraws the undo after ten seconds', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);
    vi.advanceTimersByTime(9999);
    expect(c.punchUndoState()).toBe('offered');
    vi.advanceTimersByTime(1);

    expect(c.punchUndoMessage()).toBeNull();
    c.undoPunch();
    expect(mobileApi.undoClockPunch).not.toHaveBeenCalled();
  });

  it('reports a failed undo', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    mobileApi.undoClockPunch.mockReturnValueOnce(throwError(() => new Error('window passed')));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);
    c.undoPunch();

    expect(c.punchUndoState()).toBe('failed');
    expect(c.punchUndoMessage()).toBe('kioskSetup.punchUndo.failed');
  });

  it('offers no undo when the clock state cannot be read', () => {
    signIn(1, ['ProductionWorker']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    mobileApi.clockState.mockReturnValueOnce(throwError(() => new Error('disabled')));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(1, 'Ana'), clockIn);

    expect(c.punchUndoMessage()).toBeNull();
  });

  it('offers no undo for a supervisor punch on another worker', () => {
    signIn(1, ['Manager']);
    shopFloor.clockInOut.mockReturnValue(of(undefined));
    const c = create();
    c.enterClockPhase();

    c.clockAction(worker(2, 'Ben'), clockIn);

    expect(mobileApi.clockState).not.toHaveBeenCalled();
    expect(c.punchUndoMessage()).toBeNull();
  });
});
