import { Injectable, computed, inject, signal } from '@angular/core';

import { SignalrService } from './signalr.service';

/**
 * Generic upgrade envelope. Broadcast to every console on `upgradeStateChanged`
 * and served unauthenticated at `/upgrade-status.json`. It deliberately carries
 * no version, tier, job id or schema statement — that payload reaches every
 * tablet on the shop floor.
 */
export interface UpgradeStatus {
  state: 'running' | 'succeeded' | 'stopped';
  startedAt: string;
  endedAt?: string | null;
  expiresAt?: string | null;
  message?: string | null;
}

const MARKER_URL = '/upgrade-status.json';
const MARKER_POLL_MS = 5000;

/**
 * Locks every console while this install upgrades, and reloads once it is done.
 *
 * Transport is push: the API broadcasts before it dispatches the job, while it
 * is still alive to broadcast. Seconds later it is destroyed and the hub drops
 * — expected, not a failure, so the lock is held through the disconnect rather
 * than falling through to a generic error screen.
 *
 * The marker file covers only what push cannot: a page loaded fresh mid-upgrade
 * (no broadcast to receive) and the window where the publisher is the thing
 * being replaced. Once the hub is back, push wins and the file is ignored.
 */
@Injectable({ providedIn: 'root' })
export class UpgradeLockService {
  private readonly signalr = inject(SignalrService);

  private readonly status = signal<UpgradeStatus | null>(null);
  private readonly reloadPending = signal(false);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  /** True while an upgrade is in flight and the marker has not gone stale. */
  readonly locked = computed(() => {
    const s = this.status();
    return s?.state === 'running' && !this.expired(s);
  });

  /** Generic, non-technical copy. Operator detail lives on the admin screen. */
  readonly message = computed(() => this.status()?.message ?? null);

  /** True once the API is gone, so the modal can say "restarting" rather than "working". */
  readonly apiUnreachable = computed(() => this.signalr.connectionState() !== 'connected');

  start(): void {
    if (this.started) return;
    this.started = true;

    const connection = this.signalr.getOrCreateConnection('notifications');
    connection.off('upgradeStateChanged');
    connection.on('upgradeStateChanged', (event: UpgradeStatus) => this.apply(event));

    // A console that loads mid-upgrade never saw the broadcast, so read the
    // marker once on boot regardless of hub state.
    void this.readMarker();
    this.pollTimer = setInterval(() => {
      // While the hub is up, push is authoritative and polling is waste.
      if (this.apiUnreachable() || this.locked()) void this.readMarker();
    }, MARKER_POLL_MS);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.started = false;
  }

  private apply(next: UpgradeStatus | null): void {
    const wasLocked = this.locked();
    this.status.set(next);

    // The SPA bundle running in this tab was replaced underneath it, so the
    // only correct end to an upgrade is a hard reload — exactly once.
    if (wasLocked && !this.locked() && !this.reloadPending()) {
      this.reloadPending.set(true);
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  private async readMarker(): Promise<void> {
    try {
      const response = await fetch(MARKER_URL, { cache: 'no-store' });
      // 404 is the resting state: no marker means no upgrade in flight.
      this.apply(response.ok ? ((await response.json()) as UpgradeStatus) : null);
    } catch {
      // Unreachable marker during the swap tells us nothing new — hold whatever
      // state we already have rather than releasing the lock on a network blip.
    }
  }

  /**
   * A lock nobody can clear is worse than no lock: if the agent dies holding the
   * marker, every console releases itself at expiresAt instead of leaving a shop
   * unable to use Forge.
   */
  private expired(s: UpgradeStatus): boolean {
    if (!s.expiresAt) return false;
    const at = Date.parse(s.expiresAt);
    return Number.isFinite(at) && Date.now() > at;
  }
}
