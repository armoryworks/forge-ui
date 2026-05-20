import { Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ConnectionState } from '../models/signalr.model';

@Injectable({ providedIn: 'root' })
export class SignalrService {
  private readonly authService = inject(AuthService);
  private readonly connections = new Map<string, HubConnection>();
  private readonly startPromises = new Map<string, Promise<void>>();
  private readonly _connectionState = signal<ConnectionState>('disconnected');
  private readonly _hasEverConnected = signal(false);
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly connectionState = this._connectionState.asReadonly();
  readonly hasEverConnected = this._hasEverConnected.asReadonly();

  getOrCreateConnection(hubPath: string): HubConnection {
    const existing = this.connections.get(hubPath);
    if (existing) return existing;

    // Demo mode: no backend exists. Hand out an inert stub that silently
    // accepts start/stop/on calls so feature code can run unchanged.
    if (environment.demoMode) {
      const stub = createStubHubConnection();
      this.connections.set(hubPath, stub);
      this._hasEverConnected.set(true);
      this._connectionState.set('connected');
      return stub;
    }

    const connection = this.buildHubConnection(hubPath);

    connection.onreconnecting(() => this.updateGlobalState());

    connection.onreconnected(() => {
      this._connectionState.set('connected');
    });

    connection.onclose(() => {
      if (this._hasEverConnected()) {
        this.updateGlobalState();
        // withAutomaticReconnect exhausted its retries — manually retry
        this.scheduleManualReconnect(hubPath);
      }
    });

    this.connections.set(hubPath, connection);
    return connection;
  }

  /**
   * Start a hub connection. Returns a promise that resolves once connected.
   * Retries on failure with 5s delay. The returned promise resolves on
   * eventual success so callers can await readiness.
   */
  startConnection(hubPath: string): Promise<void> {
    const existing = this.startPromises.get(hubPath);
    if (existing) return existing;

    const promise = this.startWithRetry(hubPath);
    this.startPromises.set(hubPath, promise);
    return promise;
  }

  async stopConnection(hubPath: string): Promise<void> {
    const timer = this.retryTimers.get(hubPath);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(hubPath);
    }

    this.startPromises.delete(hubPath);

    const connection = this.connections.get(hubPath);
    if (connection) {
      // Remove from map before stopping so onclose sees accurate count
      this.connections.delete(hubPath);
      await connection.stop();
    }
  }

  async stopAll(): Promise<void> {
    const paths = Array.from(this.connections.keys());
    await Promise.all(paths.map(path => this.stopConnection(path)));
    this._connectionState.set('disconnected');
  }

  /**
   * Construct a fresh HubConnection for the given hub path. Extracted as a
   * protected method so unit tests can override it (`vi.spyOn(service, ...)`)
   * without needing `vi.mock('@microsoft/signalr')` — the latter has a known
   * intermittent failure mode under Angular's `@angular/build:unit-test`
   * runner (the injected `vitest-mock-patch.js` wrapper interacts badly with
   * Vitest 4's stack-trace-based importer detection). See
   * `signalr.service.spec.ts` for the test pattern.
   */
  protected buildHubConnection(hubPath: string): HubConnection {
    return new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/${hubPath}`, {
        accessTokenFactory: () => this.authService.token() ?? '',
      })
      // F24 — retry quickly and indefinitely (capped at 5s) instead of a
      // fixed array whose 30s tail (and eventual exhaustion) left the
      // "connection lost" banner stuck long after the backend was reachable
      // again (e.g. a deploy/restart). The banner clears the instant a hub
      // reconnects, so a tight cap means it recovers within ~5s of the server
      // coming back. onclose's manual-reconnect remains the hard-close fallback.
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) =>
          Math.min(1000 * 2 ** Math.min(ctx.previousRetryCount, 2), 5000),
      })
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();
  }

  /**
   * Derives the global connection state from all active hub connections.
   * Only reports 'disconnected' when no hubs remain connected.
   */
  private updateGlobalState(): void {
    const states = Array.from(this.connections.values()).map(c => c.state);
    if (states.some(s => s === HubConnectionState.Connected)) {
      this._connectionState.set('connected');
    } else if (states.some(s => s === HubConnectionState.Reconnecting)) {
      this._connectionState.set('reconnecting');
    } else {
      this._connectionState.set('disconnected');
    }
  }

  /**
   * After withAutomaticReconnect gives up (onclose fires), recreate the
   * connection and retry indefinitely with exponential backoff.
   */
  private scheduleManualReconnect(hubPath: string): void {
    // Don't reconnect if we explicitly stopped or user logged out
    if (!this.connections.has(hubPath)) return;
    if (!this.authService.isAuthenticated()) return;

    const delay = 10_000; // 10s before first manual retry
    const timer = setTimeout(async () => {
      this.retryTimers.delete(hubPath);
      if (!this.connections.has(hubPath)) return;

      // Destroy the dead connection and create a fresh one
      this.connections.delete(hubPath);
      this.startPromises.delete(hubPath);

      try {
        await this.startConnection(hubPath);
      } catch {
        // startWithRetry handles its own retry loop
      }
    }, delay);

    this.retryTimers.set(hubPath, timer);
  }

  private async startWithRetry(hubPath: string): Promise<void> {
    const connection = this.getOrCreateConnection(hubPath);

    while (connection.state === HubConnectionState.Disconnected) {
      // Don't attempt connection if user is no longer authenticated
      if (!this.authService.isAuthenticated()) return;

      try {
        await connection.start();
        this._hasEverConnected.set(true);
        this._connectionState.set('connected');
        return;
      } catch (err: unknown) {
        // If the negotiate request returned 401, the token is expired/invalid.
        // Clear auth and stop retrying — the auth effect will handle navigation.
        if (this.isAuthError(err)) {
          this.authService.clearAuth();
          return;
        }
        await new Promise<void>(resolve => {
          this.retryTimers.set(hubPath, setTimeout(resolve, 5000));
        });
      }
    }
  }

  /**
   * Detects 401/403 errors from SignalR negotiate failures.
   * SignalR wraps HTTP errors differently depending on transport.
   */
  private isAuthError(err: unknown): boolean {
    if (err instanceof Error) {
      const msg = err.message;
      return msg.includes('401') || msg.includes('Unauthorized')
        || msg.includes('403') || msg.includes('Forbidden');
    }
    return false;
  }
}

function createStubHubConnection(): HubConnection {
  const noop = (): void => { /* noop */ };
  const asyncNoop = (): Promise<void> => Promise.resolve();
  const stub = {
    state: HubConnectionState.Connected,
    connectionId: 'demo',
    start: asyncNoop,
    stop: asyncNoop,
    invoke: <T = unknown>(): Promise<T> => Promise.resolve(undefined as unknown as T),
    send: asyncNoop,
    on: noop,
    off: noop,
    onclose: noop,
    onreconnecting: noop,
    onreconnected: noop,
    stream: () => ({ subscribe: () => ({ dispose: noop }) }),
    baseUrl: '',
  };
  return stub as unknown as HubConnection;
}
