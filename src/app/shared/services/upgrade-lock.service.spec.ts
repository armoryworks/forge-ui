import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { SignalrService } from './signalr.service';
import { UpgradeLockService, UpgradeStatus } from './upgrade-lock.service';

describe('UpgradeLockService', () => {
  let service: UpgradeLockService;
  let handlers: Record<string, (payload: UpgradeStatus) => void>;
  let connectionState: ReturnType<typeof signal<string>>;

  const running = (over: Partial<UpgradeStatus> = {}): UpgradeStatus => ({
    state: 'running',
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    message: 'Forge is being updated.',
    ...over,
  });

  beforeEach(() => {
    handlers = {};
    connectionState = signal('connected');
    const connection = {
      on: (event: string, cb: (p: UpgradeStatus) => void) => { handlers[event] = cb; },
      off: () => undefined,
    };

    TestBed.configureTestingModule({
      providers: [
        UpgradeLockService,
        {
          provide: SignalrService,
          useValue: { getOrCreateConnection: () => connection, connectionState },
        },
      ],
    });
    // The service reads the marker on start; keep the network out of the test.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    service = TestBed.inject(UpgradeLockService);
    service.start();
  });

  afterEach(() => {
    service.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('locks on the broadcast', () => {
    expect(service.locked()).toBe(false);
    handlers['upgradeStateChanged'](running());
    expect(service.locked()).toBe(true);
    expect(service.message()).toBe('Forge is being updated.');
  });

  it('holds the lock while the API is unreachable — that is the upgrade, not a fault', () => {
    handlers['upgradeStateChanged'](running());
    connectionState.set('disconnected');
    expect(service.locked()).toBe(true);
    expect(service.apiUnreachable()).toBe(true);
  });

  it('releases a stale marker so a dead agent cannot lock the shop out', () => {
    handlers['upgradeStateChanged'](running({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    expect(service.locked()).toBe(false);
  });

  it('never locks on a terminal state', () => {
    handlers['upgradeStateChanged'](running({ state: 'succeeded' }));
    expect(service.locked()).toBe(false);
  });

  it('reloads exactly once when the upgrade finishes', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { reload }, writable: true });

    handlers['upgradeStateChanged'](running());
    handlers['upgradeStateChanged'](running({ state: 'succeeded' }));
    handlers['upgradeStateChanged'](null as unknown as UpgradeStatus);
    vi.advanceTimersByTime(5000);

    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
