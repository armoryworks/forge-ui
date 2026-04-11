import { Injectable, inject } from '@angular/core';

import { SignalrService } from './signalr.service';
import { NotificationService } from './notification.service';
import { AppNotification } from '../models/app-notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationHubService {
  private readonly signalr = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;

    const connection = this.signalr.getOrCreateConnection('notifications');

    connection.off('notificationReceived');
    connection.on('notificationReceived', (notification: AppNotification) => {
      this.notificationService.push(notification);
    });

    await this.signalr.startConnection('notifications');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    const connection = this.signalr.getOrCreateConnection('notifications');
    connection.off('notificationReceived');
    await this.signalr.stopConnection('notifications');
  }
}
