import { Injectable, inject } from '@angular/core';

import { SignalrService } from './signalr.service';

@Injectable({ providedIn: 'root' })
export class TimerHubService {
  private readonly signalr = inject(SignalrService);

  private onTimerStarted: ((event: unknown) => void) | null = null;
  private onTimerStopped: ((event: unknown) => void) | null = null;

  async connect(): Promise<void> {
    const connection = this.signalr.getOrCreateConnection('timer');

    connection.on('timerStarted', (event) => this.onTimerStarted?.(event));
    connection.on('timerStopped', (event) => this.onTimerStopped?.(event));

    await this.signalr.startConnection('timer');
  }

  async disconnect(): Promise<void> {
    await this.signalr.stopConnection('timer');
  }

  onTimerStartedEvent(callback: (event: unknown) => void): void {
    this.onTimerStarted = callback;
  }

  onTimerStoppedEvent(callback: (event: unknown) => void): void {
    this.onTimerStopped = callback;
  }
}
