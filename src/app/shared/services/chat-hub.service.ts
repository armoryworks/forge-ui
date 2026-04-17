import { Injectable, inject } from '@angular/core';
import { HubConnection } from '@microsoft/signalr';

import { SignalrService } from './signalr.service';
import { AnnouncementService } from './announcement.service';
import { ChatNotificationService } from './chat-notification.service';
import { AuthService } from './auth.service';
import { Announcement } from '../models/announcement.model';
import { ChatMessageEvent } from '../../features/chat/models/chat-message-event.model';

@Injectable({ providedIn: 'root' })
export class ChatHubService {
  private readonly signalr = inject(SignalrService);
  private readonly announcementService = inject(AnnouncementService);
  private readonly chatNotification = inject(ChatNotificationService);
  private readonly authService = inject(AuthService);
  private connection: HubConnection | null = null;
  private connected = false;

  private onMessage: ((event: unknown) => void) | null = null;
  private onRoomMessage: ((event: unknown) => void) | null = null;

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

  onRoomMessageReceived(callback: (event: unknown) => void): void {
    this.onRoomMessage = callback;
  }

  async joinChannel(channelId: number): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('JoinChannel', channelId);
  }

  async leaveChannel(channelId: number): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('LeaveChannel', channelId);
  }

  private registerHandlers(): void {
    if (!this.connection) return;
    this.unregisterHandlers();
    this.connection.on('messageReceived', (event) => {
      this.onMessage?.(event);
      const msg = event as ChatMessageEvent;
      if (msg.senderId !== this.authService.user()?.id) {
        this.chatNotification.notifyIncomingMessage(msg);
      }
    });
    this.connection.on('roomMessageReceived', (event) => {
      this.onRoomMessage?.(event);
      const data = event as { roomId: number; message: ChatMessageEvent };
      const msg = data.message ?? (event as ChatMessageEvent);
      if (msg.senderId !== this.authService.user()?.id) {
        this.chatNotification.notifyIncomingMessage(msg);
      }
    });
    this.connection.on('announcementReceived', (event: Announcement) => {
      this.announcementService.pushAnnouncement(event);
    });
  }

  private unregisterHandlers(): void {
    this.connection?.off('messageReceived');
    this.connection?.off('roomMessageReceived');
    this.connection?.off('announcementReceived');
  }
}
