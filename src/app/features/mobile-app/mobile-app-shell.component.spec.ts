import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../../shared/models/mobile-api.model';
import { RunningTimer } from '../../shared/models/running-timer.model';
import { AppInfoService } from '../../shared/services/app-info.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { CrashReportingService } from '../../shared/services/crash-reporting.service';
import { InstanceService } from '../../shared/services/instance.service';
import { MobileTimerService } from '../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../shared/services/offline-queue.service';
import { PlatformService } from '../../shared/services/platform.service';
import { SharedIdentityService } from '../../shared/services/shared-identity.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { UndoService } from '../../shared/services/undo.service';
import { MobileAppShellComponent } from './mobile-app-shell.component';

interface ShellInternals {
  tabs: Signal<{ path: string }[]>;
  elapsed: Signal<string>;
  runningLabel: Signal<string>;
  stopTimer(): Promise<void>;
  operationElapsed(running: RunningTimer): string;
  stopOperation(running: RunningTimer): Promise<void>;
}

const deburr: RunningTimer = {
  id: 31, jobId: 42, jobNumber: 'JOB-42', userId: 1, operationId: 20, jobOperationId: 8,
  operationStepNumber: 20, operationTitle: 'Deburr', entryType: 'Run', timerStart: '2026-10-07T11:00:00Z',
};

describe('MobileAppShellComponent timer strip', () => {
  let shared: boolean;
  let enabled: (code: string) => boolean;
  const token = signal<string | null>('session-token');
  const active = signal<ActiveTimer | null>(null);
  const operationTimers = signal<RunningTimer[]>([]);
  const lastSyncResult = signal<object | null>(null);
  const timer = {
    active,
    operationTimers,
    refresh: vi.fn(),
    stop: vi.fn(),
    undoStop: vi.fn(),
    stopOperation: vi.fn(),
    undoStopOperation: vi.fn(),
    labelOf: (running: ActiveTimer) => running.jobNumber ?? 'timeTracking.timer',
    elapsedOf: (running: { timerStart: Date | string }, now: number) =>
      `${Math.floor((now - new Date(running.timerStart).getTime()) / 1000)}s`,
    stoppedMessage: vi.fn(() => 'stopped-message'),
  };
  const hub = {
    connect: vi.fn(), disconnect: vi.fn(), onTimerStartedEvent: vi.fn(), onTimerStoppedEvent: vi.fn(), clearCallbacks: vi.fn(),
  };
  const offer = vi.fn();
  const identified = signal(false);
  const identity = { identified, clear: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const instant = vi.fn((key: string) => key);

  function create(): ShellInternals {
    const shell = TestBed.runInInjectionContext(() => new MobileAppShellComponent()) as unknown as ShellInternals;
    TestBed.tick();
    return shell;
  }

  beforeEach(() => {
    shared = false;
    enabled = () => true;
    token.set('session-token');
    active.set(null);
    operationTimers.set([]);
    timer.stopOperation.mockReset();
    timer.undoStopOperation.mockReset().mockResolvedValue(undefined);
    lastSyncResult.set(null);
    timer.stoppedMessage.mockClear();
    timer.refresh.mockReset().mockResolvedValue(undefined);
    timer.stop.mockReset();
    timer.undoStop.mockReset().mockResolvedValue(undefined);
    hub.connect.mockReset().mockResolvedValue(undefined);
    hub.disconnect.mockReset().mockResolvedValue(undefined);
    offer.mockReset();
    identified.set(false);
    identity.clear.mockReset();
    hub.onTimerStartedEvent.mockReset();
    hub.onTimerStoppedEvent.mockReset();
    snackbar.success.mockReset();
    snackbar.error.mockReset();
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => enabled(code) } },
        { provide: CrashReportingService, useValue: { init: vi.fn().mockResolvedValue(undefined) } },
        { provide: AppInfoService, useValue: { load: vi.fn().mockResolvedValue(undefined) } },
        { provide: MobileTimerService, useValue: timer },
        { provide: TimerHubService, useValue: hub },
        { provide: OfflineQueueService, useValue: { lastSyncResult } },
        { provide: AuthService, useValue: { token } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
        { provide: PlatformService, useValue: { isNative: false, mobileShell: true } },
        { provide: SharedIdentityService, useValue: identity },
        { provide: SnackbarService, useValue: snackbar },
        { provide: UndoService, useValue: { offer } },
        { provide: TranslateService, useValue: { instant } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('loads the running timer and listens for timer events', () => {
    create();

    expect(timer.refresh).toHaveBeenCalled();
    expect(hub.connect).toHaveBeenCalledOnce();
    hub.onTimerStartedEvent.mock.calls[0][0]();
    hub.onTimerStoppedEvent.mock.calls[0][0]();
    expect(timer.refresh).toHaveBeenCalledTimes(3);
  });

  it('reloads the timer when the person on a shared device changes, without a hub', () => {
    shared = true;
    create();
    timer.refresh.mockClear();

    token.set(null);
    TestBed.tick();

    expect(timer.refresh).toHaveBeenCalledOnce();
    expect(hub.connect).not.toHaveBeenCalled();
  });

  it('reloads the timer when the app comes back to the foreground', () => {
    create();
    timer.refresh.mockClear();

    document.dispatchEvent(new Event('visibilitychange'));

    expect(timer.refresh).toHaveBeenCalledOnce();
  });

  it('ticks the elapsed time while a timer runs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T11:05:09Z'));
    const shell = create();

    active.set({ timeEntryId: 3, jobId: 42, jobNumber: 'JOB-42', operationId: null, timerStart: new Date('2026-10-07T10:00:00Z') });
    TestBed.tick();
    expect(shell.elapsed()).toBe('3909s');

    vi.advanceTimersByTime(2000);
    expect(shell.elapsed()).toBe('3911s');
  });

  it('Stop ends the timer, says which job it stopped on, and offers Undo', async () => {
    const outcome = { stopped: { jobNumber: 'JOB-42' }, queuedId: null };
    timer.stop.mockResolvedValue(outcome);
    const shell = create();

    await shell.stopTimer();

    expect(timer.stop).toHaveBeenCalledOnce();
    expect(timer.stoppedMessage).toHaveBeenCalledWith({ jobNumber: 'JOB-42' });
    const [message, compensate, closed] = offer.mock.calls[0];
    expect(message).toBe('stopped-message');
    expect(closed).toBeUndefined();
    await compensate();
    expect(timer.undoStop).toHaveBeenCalledWith(outcome, undefined);
  });

  it('on a shared device, Stop undoes as the person who stopped and ends their identity after', async () => {
    shared = true;
    identified.set(true);
    token.set('person-token');
    const outcome = { stopped: { jobNumber: 'JOB-42' }, queuedId: null };
    timer.stop.mockImplementation(async () => {
      token.set(null);
      return outcome;
    });
    const shell = create();

    await shell.stopTimer();

    const [, compensate, closed] = offer.mock.calls[0];
    await compensate();
    expect(timer.undoStop).toHaveBeenCalledWith(outcome, 'person-token');
    expect(identity.clear).not.toHaveBeenCalled();
    closed();
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('drops the timer hub on sign-out and reconnects for the next session', () => {
    create();
    expect(hub.connect).toHaveBeenCalledOnce();

    token.set(null);
    TestBed.tick();
    expect(hub.disconnect).toHaveBeenCalledOnce();

    token.set('next-session-token');
    TestBed.tick();
    expect(hub.connect).toHaveBeenCalledTimes(2);
  });

  it('names a timer with no job instead of leaving the label empty', () => {
    const shell = create();

    active.set({ timeEntryId: 5, jobId: null, jobNumber: null, operationId: null, timerStart: new Date() });

    expect(shell.runningLabel()).toBe('timeTracking.timer');
  });

  it('reloads the timer once queued changes have synced', () => {
    create();
    timer.refresh.mockClear();

    lastSyncResult.set({});
    TestBed.tick();

    expect(timer.refresh).toHaveBeenCalledOnce();
  });

  it('reports a failed Stop', async () => {
    timer.stop.mockRejectedValue(new Error('offline'));
    const shell = create();

    await shell.stopTimer();

    expect(snackbar.error).toHaveBeenCalledOnce();
  });

  it('ticks each running operation timer even with no job-level timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T11:00:05Z'));
    const shell = create();

    operationTimers.set([deburr]);
    TestBed.tick();
    expect(shell.operationElapsed(deburr)).toBe('5s');

    vi.advanceTimersByTime(3000);
    expect(shell.operationElapsed(deburr)).toBe('8s');
  });

  it('stops one operation timer, names it, and undoes as the person on a shared device', async () => {
    shared = true;
    identified.set(true);
    token.set('person-token');
    const outcome = { stopped: deburr, queuedId: null };
    timer.stopOperation.mockResolvedValue(outcome);
    const shell = create();

    await shell.stopOperation(deburr);

    expect(timer.stopOperation).toHaveBeenCalledWith(deburr);
    expect(instant).toHaveBeenCalledWith('mobileApp.operations.timerLabel', { jobNumber: 'JOB-42', step: 20, title: 'Deburr' });
    const [message, compensate, closed] = offer.mock.calls[0];
    expect(message).toBe('mobileApp.operations.stopped');
    await compensate();
    expect(timer.undoStopOperation).toHaveBeenCalledWith(outcome, 'person-token');
    closed();
    expect(identity.clear).toHaveBeenCalledOnce();
  });

  it('reports a failed operation Stop', async () => {
    timer.stopOperation.mockRejectedValue(new Error('offline'));
    const shell = create();

    await shell.stopOperation(deburr);

    expect(snackbar.error).toHaveBeenCalledOnce();
    expect(offer).not.toHaveBeenCalled();
  });

  it('shows a tab only for each screen that is on, and none when every screen is off', () => {
    enabled = (code) => code === 'CAP-MOBILE-JOBS';
    expect(create().tabs().map((tab) => tab.path)).toEqual(['/app/jobs']);

    enabled = () => false;
    expect(create().tabs()).toEqual([]);
  });
});
