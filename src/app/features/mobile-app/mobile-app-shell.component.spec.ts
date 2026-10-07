import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TranslateService } from '@ngx-translate/core';

import { ActiveTimer } from '../../shared/models/mobile-api.model';
import { AppInfoService } from '../../shared/services/app-info.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { CrashReportingService } from '../../shared/services/crash-reporting.service';
import { InstanceService } from '../../shared/services/instance.service';
import { MobileTimerService } from '../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../shared/services/offline-queue.service';
import { PlatformService } from '../../shared/services/platform.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { MobileAppShellComponent } from './mobile-app-shell.component';

interface ShellInternals {
  elapsed: Signal<string>;
  runningLabel: Signal<string>;
  stopTimer(): Promise<void>;
}

describe('MobileAppShellComponent timer strip', () => {
  let shared: boolean;
  const token = signal<string | null>('session-token');
  const active = signal<ActiveTimer | null>(null);
  const lastSyncResult = signal<object | null>(null);
  const timer = {
    active,
    refresh: vi.fn(),
    stop: vi.fn(),
    labelOf: (running: ActiveTimer) => running.jobNumber ?? 'timeTracking.timer',
    stoppedMessage: vi.fn(() => 'stopped-message'),
  };
  const hub = { connect: vi.fn(), onTimerStartedEvent: vi.fn(), onTimerStoppedEvent: vi.fn(), clearCallbacks: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn() };
  const instant = vi.fn((key: string) => key);

  function create(): ShellInternals {
    const shell = TestBed.runInInjectionContext(() => new MobileAppShellComponent()) as unknown as ShellInternals;
    TestBed.tick();
    return shell;
  }

  beforeEach(() => {
    shared = false;
    token.set('session-token');
    active.set(null);
    lastSyncResult.set(null);
    timer.stoppedMessage.mockClear();
    timer.refresh.mockReset().mockResolvedValue(undefined);
    timer.stop.mockReset();
    hub.connect.mockReset().mockResolvedValue(undefined);
    hub.onTimerStartedEvent.mockReset();
    hub.onTimerStoppedEvent.mockReset();
    snackbar.success.mockReset();
    snackbar.error.mockReset();
    instant.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: CrashReportingService, useValue: { init: vi.fn().mockResolvedValue(undefined) } },
        { provide: AppInfoService, useValue: { load: vi.fn().mockResolvedValue(undefined) } },
        { provide: MobileTimerService, useValue: timer },
        { provide: TimerHubService, useValue: hub },
        { provide: OfflineQueueService, useValue: { lastSyncResult } },
        { provide: AuthService, useValue: { token } },
        { provide: InstanceService, useValue: { instance: () => ({ id: 'shop', shared }) } },
        { provide: PlatformService, useValue: { isNative: false, mobileShell: true } },
        { provide: SnackbarService, useValue: snackbar },
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
    expect(shell.elapsed()).toBe('1:05:09');

    vi.advanceTimersByTime(2000);
    expect(shell.elapsed()).toBe('1:05:11');
  });

  it('Stop ends the timer and says which job it stopped on', async () => {
    timer.stop.mockResolvedValue({ jobNumber: 'JOB-42' });
    const shell = create();

    await shell.stopTimer();

    expect(timer.stop).toHaveBeenCalledOnce();
    expect(timer.stoppedMessage).toHaveBeenCalledWith({ jobNumber: 'JOB-42' });
    expect(snackbar.success).toHaveBeenCalledWith('stopped-message');
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
});
