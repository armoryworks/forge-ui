import { Injectable, inject } from '@angular/core';
import { HubConnection } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';

/**
 * Subscribes the dark GL accounting screens to the backend's `accountingChanged` push (broadcast by the
 * server's GlChangeBroadcastInterceptor on any GL write), so they auto-refresh instead of relying on a manual
 * Refresh button. Multi-subscriber: each screen registers a reload callback and gets a disposer; the shared
 * connection stays up while the app runs (mirrors the notification hub). A reconnect re-fires every callback —
 * changes may have landed while the socket was down.
 */
@Injectable({ providedIn: 'root' })
export class AccountingHubService {
  private readonly signalr = inject(SignalrService);
  private connection: HubConnection | null = null;
  private connecting = false;
  private readonly callbacks = new Set<() => void>();

  /** Register a reload callback; returns a disposer to call on component destroy. */
  subscribe(callback: () => void): () => void {
    this.callbacks.add(callback);
    void this.ensureConnected();
    return () => this.callbacks.delete(callback);
  }

  private async ensureConnected(): Promise<void> {
    if (this.connection || this.connecting) return;
    this.connecting = true;
    try {
      const conn = this.signalr.getOrCreateConnection('accounting');
      conn.off('accountingChanged'); // dedupe in case a prior start attempt already registered
      conn.on('accountingChanged', () => this.fireAll());
      conn.onreconnected(() => this.fireAll());
      await this.signalr.startConnection('accounting');
      this.connection = conn;
    } catch {
      // Initial start failed (backend unreachable) — null so a later subscribe retries.
      this.connection = null;
    } finally {
      this.connecting = false;
    }
  }

  private fireAll(): void {
    // Snapshot so a callback that unsubscribes mid-iteration can't disturb the loop.
    for (const cb of [...this.callbacks]) cb();
  }
}
