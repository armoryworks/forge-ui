import { Injectable, inject } from '@angular/core';

import { SignalrService } from './signalr.service';
import { NotificationService } from './notification.service';
import { AppNotification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationHubService {
  private readonly signalr = inject(SignalrService);
  private readonly notificationService = inject(NotificationService);

  async connect(): Promise<void> {
    const connection = this.signalr.getOrCreateConnection('notifications');

    connection.on('notificationReceived', (notification: AppNotification) => {
      this.notificationService.push(notification);
    });

    await this.signalr.startConnection('notifications');
  }

  async disconnect(): Promise<void> {
    await this.signalr.stopConnection('notifications');
  }
}
