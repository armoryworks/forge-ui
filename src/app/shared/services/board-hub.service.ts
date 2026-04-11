import { Injectable, inject } from '@angular/core';
import { HubConnection, HubConnectionState } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';

@Injectable({ providedIn: 'root' })
export class BoardHubService {
  private readonly signalr = inject(SignalrService);
  private connection: HubConnection | null = null;
  private connectPromise: Promise<void> | null = null;
  private currentBoardGroup: number | null = null;
  private currentJobGroup: number | null = null;

  private onJobCreated: ((event: unknown) => void) | null = null;
  private onJobMoved: ((event: unknown) => void) | null = null;
  private onJobUpdated: ((event: unknown) => void) | null = null;
  private onJobPositionChanged: ((event: unknown) => void) | null = null;
  private onSubtaskChanged: ((event: unknown) => void) | null = null;

  async connect(): Promise<void> {
    this.connection = this.signalr.getOrCreateConnection('board');
    this.registerHandlers();

    // Re-join groups after automatic reconnection (groups are server-side, lost on disconnect)
    this.connection.onreconnected(async () => {
      await this.rejoinGroups();
    });

    this.connectPromise = this.signalr.startConnection('board');
    await this.connectPromise;
  }

  async disconnect(): Promise<void> {
    await this.leaveBoard();
    await this.leaveJob();
    this.unregisterHandlers();
    await this.signalr.stopConnection('board');
    this.connection = null;
    this.connectPromise = null;
  }

  async joinBoard(trackTypeId: number): Promise<void> {
    await this.connectPromise;
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    if (this.currentBoardGroup !== null) {
      await this.leaveBoard();
    }
    await this.connection.invoke('JoinBoard', trackTypeId);
    this.currentBoardGroup = trackTypeId;
  }

  async leaveBoard(): Promise<void> {
    if (this.currentBoardGroup !== null && this.connection) {
      try {
        await this.connection.invoke('LeaveBoard', this.currentBoardGroup);
      } catch { /* connection may already be closed */ }
      this.currentBoardGroup = null;
    }
  }

  async joinJob(jobId: number): Promise<void> {
    await this.connectPromise;
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    if (this.currentJobGroup !== null) {
      await this.leaveJob();
    }
    await this.connection.invoke('JoinJob', jobId);
    this.currentJobGroup = jobId;
  }

  async leaveJob(): Promise<void> {
    if (this.currentJobGroup !== null && this.connection) {
      try {
        await this.connection.invoke('LeaveJob', this.currentJobGroup);
      } catch { /* connection may already be closed */ }
      this.currentJobGroup = null;
    }
  }

  onJobCreatedEvent(callback: (event: unknown) => void): void {
    this.onJobCreated = callback;
  }

  onJobMovedEvent(callback: (event: unknown) => void): void {
    this.onJobMoved = callback;
  }

  onJobUpdatedEvent(callback: (event: unknown) => void): void {
    this.onJobUpdated = callback;
  }

  onJobPositionChangedEvent(callback: (event: unknown) => void): void {
    this.onJobPositionChanged = callback;
  }

  onSubtaskChangedEvent(callback: (event: unknown) => void): void {
    this.onSubtaskChanged = callback;
  }

  private registerHandlers(): void {
    if (!this.connection) return;

    // Remove any existing handlers to prevent accumulation on reconnect
    this.unregisterHandlers();

    this.connection.on('jobCreated', (event) => this.onJobCreated?.(event));
    this.connection.on('jobMoved', (event) => this.onJobMoved?.(event));
    this.connection.on('jobUpdated', (event) => this.onJobUpdated?.(event));
    this.connection.on('jobPositionChanged', (event) => this.onJobPositionChanged?.(event));
    this.connection.on('subtaskChanged', (event) => this.onSubtaskChanged?.(event));
  }

  private unregisterHandlers(): void {
    if (!this.connection) return;
    this.connection.off('jobCreated');
    this.connection.off('jobMoved');
    this.connection.off('jobUpdated');
    this.connection.off('jobPositionChanged');
    this.connection.off('subtaskChanged');
  }

  private async rejoinGroups(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    try {
      if (this.currentBoardGroup !== null) {
        await this.connection.invoke('JoinBoard', this.currentBoardGroup);
      }
      if (this.currentJobGroup !== null) {
        await this.connection.invoke('JoinJob', this.currentJobGroup);
      }
    } catch {
      // Connection may have dropped again — automatic reconnect will retry
    }
  }
}
