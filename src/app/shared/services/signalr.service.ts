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
  private hasConnected = false;
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly connectionState = this._connectionState.asReadonly();

  getOrCreateConnection(hubPath: string): HubConnection {
    const existing = this.connections.get(hubPath);
    if (existing) return existing;

    const connection = new HubConnectionBuilder()
      .withUrl(`${environment.hubUrl}/${hubPath}`, {
        accessTokenFactory: () => this.authService.token() ?? '',
      })
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000, 30000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    connection.onreconnecting((error) => {
      if (!environment.production) console.warn(`[SignalR] ${hubPath} reconnecting...`, error);
      this.updateGlobalState();
    });

    connection.onreconnected((connectionId) => {
      if (!environment.production) console.log(`[SignalR] ${hubPath} reconnected (${connectionId})`);
      this._connectionState.set('connected');
    });

    connection.onclose((error) => {
      if (!environment.production) console.warn(`[SignalR] ${hubPath} closed`, error);
      if (this.hasConnected) {
        this.updateGlobalState();
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
    this.hasConnected = false;
    this._connectionState.set('disconnected');
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

  private async startWithRetry(hubPath: string): Promise<void> {
    const connection = this.getOrCreateConnection(hubPath);

    while (connection.state === HubConnectionState.Disconnected) {
      try {
        await connection.start();
        this.hasConnected = true;
        this._connectionState.set('connected');
        if (!environment.production) console.log(`[SignalR] Connected to ${hubPath}`);
        return;
      } catch (err) {
        if (!environment.production) console.warn(`[SignalR] Failed to connect to ${hubPath}, retrying in 5s...`, err);
        await new Promise<void>(resolve => {
          this.retryTimers.set(hubPath, setTimeout(resolve, 5000));
        });
      }
    }
  }
}
