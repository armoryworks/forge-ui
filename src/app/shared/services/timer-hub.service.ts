import { Injectable, inject } from '@angular/core';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';
import { TimerEvent } from '../models/timer-event.model';

@Injectable({ providedIn: 'root' })
export class TimerHubService {
  private readonly signalr = inject(SignalrService);
  private connection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;
  private currentUserGroup: number | null = null;

  private onTimerStarted: ((event: TimerEvent) => void) | null = null;
  private onTimerStopped: ((event: TimerEvent) => void) | null = null;

  async connect(): Promise<void> {
    this.connection = this.signalr.getOrCreateConnection('timer');
    this.registerHandlers();

    this.connection.onreconnected(async () => {
      await this.rejoinGroups();
    });

    this.connectPromise = this.signalr.startConnection('timer');
    await this.connectPromise;
  }

  async disconnect(): Promise<void> {
    await this.leaveUserGroup();
    await this.signalr.stopConnection('timer');
    this.connection = null;
    this.connectPromise = null;
  }

  async joinUserGroup(userId: number): Promise<void> {
    await this.connectPromise;
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    if (this.currentUserGroup !== null) {
      await this.leaveUserGroup();
    }
    await this.connection.invoke('JoinUserGroup', userId);
    this.currentUserGroup = userId;
  }

  async leaveUserGroup(): Promise<void> {
    if (this.currentUserGroup !== null && this.connection) {
      try {
        await this.connection.invoke('LeaveUserGroup', this.currentUserGroup);
      } catch { /* connection may already be closed */ }
      this.currentUserGroup = null;
    }
  }

  onTimerStartedEvent(callback: (event: TimerEvent) => void): void {
    this.onTimerStarted = callback;
  }

  onTimerStoppedEvent(callback: (event: TimerEvent) => void): void {
    this.onTimerStopped = callback;
  }

  private registerHandlers(): void {
    if (!this.connection) return;

    this.connection.on('timerStarted', (event: TimerEvent) => this.onTimerStarted?.(event));
    this.connection.on('timerStopped', (event: TimerEvent) => this.onTimerStopped?.(event));
  }

  private async rejoinGroups(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    try {
      if (this.currentUserGroup !== null) {
        await this.connection.invoke('JoinUserGroup', this.currentUserGroup);
      }
    } catch {
      // Connection may have dropped again — automatic reconnect will retry
    }
  }
}
