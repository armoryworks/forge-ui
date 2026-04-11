import { Injectable, inject } from '@angular/core';
import { HubConnection } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';

@Injectable({ providedIn: 'root' })
export class ChatHubService {
  private readonly signalr = inject(SignalrService);
  private connection: HubConnection | null = null;
  private connected = false;

  private onMessage: ((event: unknown) => void) | null = null;

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;

    this.connection = this.signalr.getOrCreateConnection('chat');
    this.registerHandlers();
    await this.signalr.startConnection('chat');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.unregisterHandlers();
    await this.signalr.stopConnection('chat');
    this.connection = null;
  }

  onMessageReceived(callback: (event: unknown) => void): void {
    this.onMessage = callback;
  }

  private registerHandlers(): void {
    if (!this.connection) return;
    this.unregisterHandlers();
    this.connection.on('messageReceived', (event) => this.onMessage?.(event));
  }

  private unregisterHandlers(): void {
    this.connection?.off('messageReceived');
  }
}
