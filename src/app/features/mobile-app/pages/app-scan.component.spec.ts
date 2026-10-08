import { Signal, WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { AuthService } from '../../../shared/services/auth.service';
import { CameraScannerService } from '../../../shared/services/camera-scanner.service';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { MobileMoveConfirmService } from '../../../shared/services/mobile-move-confirm.service';
import { MobileTimerService } from '../../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { PlatformService } from '../../../shared/services/platform.service';
import { ScanFeedbackService } from '../../../shared/services/scan-feedback.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { UndoService } from '../../../shared/services/undo.service';
import { ScanAction } from '../components/scan-action-sheet/scan-action-sheet.component';
import { AppScanComponent } from './app-scan.component';

interface ScanInternals {
  result: WritableSignal<ScanResolveResult | null>;
  actingAs: Signal<string | null>;
  identifying: Signal<boolean>;
  notice: Signal<string | null>;
  onAction(action: ScanAction): Promise<void>;
  onIdentified(): void;
  notYou(): void;
}

const job: ScanResolveResult = { kind: 'job', id: 42, code: 'JOB-42', label: 'JOB-42', subtitle: null };

describe('AppScanComponent', () => {
  let shared: boolean;
  const offer = vi.fn();
  const identity = {
    identified: signal(true),
    person: signal<{ firstName: string; lastName: string } | null>({ firstName: 'Ana', lastName: 'Ruiz' }),
    clear: vi.fn(),
    touch: vi.fn(),
  };
  const timer = {
    active: signal(null),
    operationTracking: signal(false),
    toggle: vi.fn(),
    stop: vi.fn(),
    stoppedMessage: vi.fn(() => 'stopped-message'),
    runningMessage: vi.fn(() => 'running-message'),
    undoStart: vi.fn(),
    undoStop: vi.fn(),
    refresh: vi.fn(),
  };
  const api = {
    advanceJob: vi.fn(),
    moveJobToStage: vi.fn(),
    stopTimer: vi.fn(),
    jobStatus: vi.fn(),
  };
  const confirmMove = {
    needed: vi.fn(),
    ask: vi.fn(),
    isConfirmRequired: vi.fn((_err: unknown) => false),
    failureMessage: vi.fn((_err: unknown) => 'mobileApp.jobs.actionFailed'),
  };
  const router = { navigate: vi.fn() };

  function refuseUnconfirmed(): void {
    const refusal = { code: 'confirm-required' };
    api.advanceJob.mockImplementation((_id: number, _code: string, confirmed: boolean) => confirmed
      ? of({ status: { stageName: 'Invoiced' }, previousStageId: 3, previousStageName: 'Shipped', collapsed: false })
      : throwError(() => refusal));
    confirmMove.isConfirmRequired.mockImplementation((err: unknown) => err === refusal);
    confirmMove.needed.mockReturnValue(true);
  }

  function create(): ScanInternals {
    const component = TestBed.runInInjectionContext(() => new AppScanComponent());
    const internals = component as unknown as ScanInternals;
    internals.result.set(job);
    return internals;
  }

  beforeEach(() => {
    shared = true;
    offer.mockReset();
    identity.identified.set(true);
    identity.clear.mockReset();
    identity.touch.mockReset();
    timer.operationTracking.set(false);
    timer.refresh.mockReset();
    api.stopTimer.mockReset().mockReturnValue(of({}));
    timer.toggle.mockReset().mockResolvedValue({ started: { entryId: 11, queuedIds: [], previous: null } });
    timer.stop.mockReset().mockResolvedValue({ stopped: { jobNumber: 'JOB-42' }, queuedId: null });
    timer.undoStart.mockReset().mockResolvedValue(undefined);
    timer.undoStop.mockReset().mockResolvedValue(undefined);
    api.advanceJob.mockReset().mockReturnValue(of({
      status: { stageName: 'Machining' }, previousStageId: 3, previousStageName: 'Queued', collapsed: false,
    }));
    api.moveJobToStage.mockReset().mockReturnValue(of({}));
    api.stopTimer.mockReset().mockReturnValue(of({}));
    api.jobStatus.mockReset().mockReturnValue(of({ id: 42, nextStageName: 'Machining' }));
    confirmMove.needed.mockReset().mockReturnValue(false);
    confirmMove.ask.mockReset().mockResolvedValue(true);
    confirmMove.isConfirmRequired.mockReset().mockReturnValue(false);
    confirmMove.failureMessage.mockReset().mockReturnValue('mobileApp.jobs.actionFailed');
    router.navigate.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: CameraScannerService, useValue: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() } },
        { provide: MobileApiService, useValue: api },
        { provide: ScanFeedbackService, useValue: { tick: vi.fn(), doubleBuzz: vi.fn() } },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn() } },
        { provide: Router, useValue: router },
        { provide: MobileMoveConfirmService, useValue: confirmMove },
        { provide: MatDialog, useValue: {} },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: identity },
        { provide: AuthService, useValue: { token: () => 'person-token' } },
        { provide: MobileTimerService, useValue: timer },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
      ],
    });
  });

  it('on a shared device, ends the identity when the undo toast closes after a start', async () => {
    await create().onAction('start');

    expect(timer.toggle).toHaveBeenCalledWith(42, 'JOB-42');
    const [, compensate, closed] = offer.mock.calls[0];
    expect(identity.touch).not.toHaveBeenCalled();
    expect(identity.clear).not.toHaveBeenCalled();

    closed();
    expect(identity.clear).toHaveBeenCalledOnce();

    await compensate();
    expect(timer.undoStart).toHaveBeenCalledWith(11, null, 'person-token');
  });

  it('on a shared device, identifies first and then starts with the server-side timer state', async () => {
    identity.identified.set(false);
    const scan = create();

    await scan.onAction('start');
    expect(scan.identifying()).toBe(true);
    expect(timer.toggle).not.toHaveBeenCalled();

    identity.identified.set(true);
    scan.onIdentified();
    await vi.waitFor(() => expect(offer).toHaveBeenCalledOnce());

    expect(timer.toggle).toHaveBeenCalledWith(42, 'JOB-42');
  });

  it('leaves the timer alone when the identified person already runs it on that job', async () => {
    identity.identified.set(false);
    const running = { jobId: 42, jobNumber: 'JOB-42' };
    timer.toggle.mockResolvedValue({ alreadyRunning: running });
    const scan = create();

    await scan.onAction('start');
    identity.identified.set(true);
    scan.onIdentified();
    await vi.waitFor(() => expect(scan.notice()).toBe('running-message'));

    expect(timer.stop).not.toHaveBeenCalled();
    expect(offer).not.toHaveBeenCalled();
    expect(timer.runningMessage).toHaveBeenCalledWith(running);
    expect(identity.clear).not.toHaveBeenCalled();
  });

  it('undoing a switch hands the previous timer to the compensation', async () => {
    const previous = { jobId: 7, jobNumber: 'JOB-7', operationId: 5 };
    timer.toggle.mockResolvedValue({ started: { entryId: 11, queuedIds: [], previous } });

    await create().onAction('start');

    await offer.mock.calls[0][1]();
    expect(timer.undoStart).toHaveBeenCalledWith(11, previous, 'person-token');
  });

  it('undoes a shared-device move with the captured token', async () => {
    await create().onAction('move');

    const [, compensate, closed] = offer.mock.calls[0];
    await compensate();
    expect(api.moveJobToStage).toHaveBeenCalledWith(42, 3, 'person-token');
    expect(closed).toBeTypeOf('function');
  });

  it('keeps the identity alive for details', async () => {
    await create().onAction('details');

    expect(identity.touch).toHaveBeenCalledOnce();
    expect(identity.clear).not.toHaveBeenCalled();
  });

  it('on a personal device, undoes a start without a token and leaves the session alone', async () => {
    shared = false;

    await create().onAction('start');

    const [, compensate, closed] = offer.mock.calls[0];
    expect(closed).toBeUndefined();
    await compensate();
    expect(timer.undoStart).toHaveBeenCalledWith(11, null, undefined);
  });

  it('stops the timer without changing the stage, offers Undo, and ends the identity when the toast closes', async () => {
    await create().onAction('stop');

    expect(timer.stop).toHaveBeenCalledOnce();
    expect(api.advanceJob).not.toHaveBeenCalled();
    const [message, compensate, closed] = offer.mock.calls[0];
    expect(message).toBe('stopped-message');
    expect(identity.clear).not.toHaveBeenCalled();
    expect(identity.touch).not.toHaveBeenCalled();

    await compensate();
    expect(timer.undoStop).toHaveBeenCalledWith({ stopped: { jobNumber: 'JOB-42' }, queuedId: null }, 'person-token');
    closed();
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('completes by stopping the newest timer, as before, while operation tracking is off', async () => {
    await create().onAction('complete');

    expect(api.stopTimer).toHaveBeenCalledWith();
    expect(api.advanceJob).toHaveBeenCalledWith(42, 'JOB-42', false, true);
    expect(api.advanceJob.mock.invocationCallOrder[0]).toBeLessThan(api.stopTimer.mock.invocationCallOrder[0]);
  });

  it('completes by stopping the person\'s timer on that job while operation tracking is on', async () => {
    timer.operationTracking.set(true);

    await create().onAction('complete');

    expect(api.stopTimer).toHaveBeenCalledWith(undefined, { jobId: 42 });
    expect(api.advanceJob).toHaveBeenCalledWith(42, 'JOB-42', false, true);
  });

  it('names the identified person and clears them on Not you', () => {
    const scan = create();
    expect(scan.actingAs()).toBe('Ana Ruiz');

    scan.notYou();
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('moves an ordinary column with the one request it always sent, and offers Undo', async () => {
    await create().onAction('move');

    expect(api.jobStatus).not.toHaveBeenCalled();
    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenCalledWith(42, 'JOB-42', false, true);
    expect(offer).toHaveBeenCalledOnce();
  });

  it('completes an ordinary column without reading the job status', async () => {
    await create().onAction('complete');

    expect(api.jobStatus).not.toHaveBeenCalled();
    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(offer).toHaveBeenCalledOnce();
  });

  it('asks when the server needs a move confirmed, resends it confirmed, then offers no Undo', async () => {
    refuseUnconfirmed();
    const scan = create();

    await scan.onAction('move');

    expect(confirmMove.ask).toHaveBeenCalledWith({ id: 42, nextStageName: 'Machining' });
    expect(api.advanceJob).toHaveBeenLastCalledWith(42, 'JOB-42', true);
    expect(offer).not.toHaveBeenCalled();
    expect(scan.notice()).toBe('mobileApp.jobs.movedTo');
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('moves nothing and keeps the timer when the person declines', async () => {
    refuseUnconfirmed();
    confirmMove.ask.mockResolvedValue(false);

    await create().onAction('complete');

    expect(api.stopTimer).not.toHaveBeenCalled();
    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(offer).not.toHaveBeenCalled();
  });

  it('confirms a complete once, then stops the timer', async () => {
    refuseUnconfirmed();

    await create().onAction('complete');

    expect(confirmMove.ask).toHaveBeenCalledOnce();
    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenLastCalledWith(42, 'JOB-42', true);
  });

  it('still stops the timer when a complete fails for another reason', async () => {
    api.advanceJob.mockReturnValue(throwError(() => new Error('down')));
    const scan = create();

    await scan.onAction('complete');

    expect(api.stopTimer).toHaveBeenCalledOnce();
    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(scan.notice()).toBe('mobileApp.jobs.actionFailed');
  });

  it('shows the server\'s reason when a complete is refused by a quality gate', async () => {
    const real = TestBed.runInInjectionContext(() => new MobileMoveConfirmService());
    confirmMove.failureMessage.mockImplementation((err: unknown) => real.failureMessage(err));
    api.advanceJob.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { code: 'business-rule', detail: 'Quality checks are not complete.' },
    })));
    const scan = create();

    await scan.onAction('complete');

    expect(api.advanceJob).toHaveBeenCalledOnce();
    expect(api.advanceJob).toHaveBeenCalledWith(42, 'JOB-42', false, true);
    expect(confirmMove.ask).not.toHaveBeenCalled();
    expect(scan.notice()).toBe('Quality checks are not complete.');
  });

  it('offers no Undo when a confirmed move is saved offline', async () => {
    refuseUnconfirmed();
    api.advanceJob.mockImplementation((_id: number, _code: string, confirmed: boolean) => confirmed
      ? of({ queued: true, entryId: 'q-1' })
      : throwError(() => ({ code: 'confirm-required' })));
    confirmMove.isConfirmRequired.mockImplementation((err: unknown) => (err as { code?: string }).code === 'confirm-required');
    const scan = create();

    await scan.onAction('move');

    expect(offer).not.toHaveBeenCalled();
    expect(scan.notice()).toBe('mobileApp.offline.queued');
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('opens receiving for a scanned purchase order', async () => {
    const scan = create();
    scan.result.set({ kind: 'purchaseOrder', id: 8, code: 'PO-1008', label: 'PO-1008', subtitle: null });

    await scan.onAction('receive');

    expect(router.navigate).toHaveBeenCalledWith(['/app/receive', 8]);
  });
});

describe('AppScanComponent requests', () => {
  let http: HttpTestingController;
  let timer: MobileTimerService;
  const offer = vi.fn();

  function create(): ScanInternals {
    const component = TestBed.runInInjectionContext(() => new AppScanComponent());
    const internals = component as unknown as ScanInternals;
    internals.result.set(job);
    return internals;
  }

  async function next(method: string, url: string): Promise<TestRequest> {
    let request: TestRequest | undefined;
    await vi.waitFor(() => {
      request = http.expectOne({ method, url });
    });
    return request!;
  }

  async function signIn(operationTracking: boolean): Promise<void> {
    const refreshed = timer.refresh();
    (await next('GET', '/api/v1/job-operations/config')).flush({ operationTracking });
    (await next('GET', '/api/v1/time-tracking/timer/active')).flush(null, { status: 204, statusText: 'No Content' });
    if (operationTracking) (await next('GET', '/api/v1/time-tracking/timers/active')).flush([]);
    await refreshed;
  }

  beforeEach(() => {
    offer.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CameraScannerService, useValue: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() } },
        { provide: ScanFeedbackService, useValue: { tick: vi.fn(), doubleBuzz: vi.fn() } },
        { provide: UndoService, useValue: { offer } },
        { provide: OfflineQueueService, useValue: { remove: vi.fn(), enqueue: vi.fn() } },
        { provide: PlatformService, useValue: { mobileShell: true, isNative: false } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SharedIdentityService, useValue: { identified: signal(false), person: signal(null), clear: vi.fn(), touch: vi.fn() } },
        { provide: AuthService, useValue: { token: () => 'session-token', isAuthenticated: () => true, user: signal({ id: 1 }) } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared: false }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    timer = TestBed.inject(MobileTimerService);
  });

  afterEach(() => http.verify());

  it('with operation tracking off, start, complete and stop send exactly the requests they always sent', async () => {
    await signIn(false);
    const scan = create();

    const started = scan.onAction('start');
    (await next('GET', '/api/v1/time-tracking/timer/active')).flush(null, { status: 204, statusText: 'No Content' });
    const start = await next('POST', '/api/v1/time-tracking/timer/start');
    expect(start.request.body).toEqual({ jobId: 42, operationId: null });
    expect(start.request.headers.has('Idempotency-Key')).toBe(true);
    start.flush({ id: 11, jobId: 42, jobNumber: 'JOB-42', timerStart: '2026-10-07T10:00:00Z' });
    await started;

    scan.result.set(job);
    const stopped = scan.onAction('stop');
    const stop = await next('POST', '/api/v1/time-tracking/timer/stop');
    expect(stop.request.body).toEqual({});
    stop.flush({});
    await stopped;

    scan.result.set(job);
    const completed = scan.onAction('complete');
    const completeStop = await next('POST', '/api/v1/time-tracking/timer/stop');
    expect(completeStop.request.body).toEqual({});
    completeStop.flush({});
    (await next('GET', '/api/v1/time-tracking/timer/active')).flush(null, { status: 204, statusText: 'No Content' });
    const advance = await next('POST', '/api/v1/mobile/jobs/42/advance');
    expect(advance.request.body).toEqual({ scanCode: 'JOB-42' });
    advance.flush({ status: { stageName: 'Machining' }, previousStageId: 3, previousStageName: 'Queued', collapsed: false });
    await completed;

    http.expectNone((r) => r.url.includes('/operations') || r.url.includes('/timers/active'));
  });

  it('with operation tracking on, complete stops the person\'s timer on that job', async () => {
    await signIn(true);
    const scan = create();

    const completed = scan.onAction('complete');
    const stop = await next('POST', '/api/v1/time-tracking/timer/stop');
    expect(stop.request.body).toEqual({ jobId: 42 });
    stop.flush({});
    (await next('GET', '/api/v1/time-tracking/timers/active')).flush([]);
    (await next('POST', '/api/v1/mobile/jobs/42/advance'))
      .flush({ status: { stageName: 'Machining' }, previousStageId: 3, previousStageName: 'Queued', collapsed: false });
    await completed;
  });
});
