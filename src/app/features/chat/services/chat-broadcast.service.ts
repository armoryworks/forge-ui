import { DestroyRef, Injectable, inject, signal } from '@angular/core';

export interface ChatBroadcastMessage {
  type: 'openConversation' | 'messageReceived' | 'conversationChanged' | 'windowClosed' | 'windowOpened' | 'focusWindow';
  channelId?: number;
  userId?: number;
  messageId?: number;
}

const CHANNEL_NAME = 'qb-chat-sync';
const POPOUT_WINDOW_NAME = 'qb-chat';
const POPOUT_FEATURES = 'width=800,height=600,menubar=no,toolbar=no,location=no,status=no';
const WINDOW_CHECK_INTERVAL = 2000;

@Injectable({ providedIn: 'root' })
export class ChatBroadcastService {
  private readonly destroyRef = inject(DestroyRef);

  private channel: BroadcastChannel | null = null;
  private popoutWindow: Window | null = null;
  private windowCheckTimer: ReturnType<typeof setInterval> | null = null;

  readonly lastMessage = signal<ChatBroadcastMessage | null>(null);
  readonly isPopoutOpen = signal(false);

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<ChatBroadcastMessage>) => {
        this.handleMessage(event.data);
      };
    }

    this.destroyRef.onDestroy(() => {
      this.stopWindowCheck();
      this.channel?.close();
      this.channel = null;
    });
  }

  send(msg: ChatBroadcastMessage): void {
    this.channel?.postMessage(msg);
  }

  openPopout(): void {
    if (this.popoutWindow && !this.popoutWindow.closed) {
      this.popoutWindow.focus();
      return;
    }

    this.popoutWindow = window.open('/chat/popout', POPOUT_WINDOW_NAME, POPOUT_FEATURES);
    this.isPopoutOpen.set(true);
    this.startWindowCheck();
  }

  closePopout(): void {
    if (this.popoutWindow && !this.popoutWindow.closed) {
      this.popoutWindow.close();
    }
    this.popoutWindow = null;
    this.isPopoutOpen.set(false);
    this.stopWindowCheck();
  }

  focusPopout(): void {
    if (this.popoutWindow && !this.popoutWindow.closed) {
      this.popoutWindow.focus();
    }
    this.send({ type: 'focusWindow' });
  }

  openConversationInPopout(options: { channelId?: number; userId?: number }): void {
    if (!this.isPopoutOpen()) {
      this.openPopout();
    }
    this.send({
      type: 'openConversation',
      channelId: options.channelId,
      userId: options.userId,
    });
  }

  private handleMessage(msg: ChatBroadcastMessage): void {
    this.lastMessage.set(msg);

    switch (msg.type) {
      case 'windowOpened':
        this.isPopoutOpen.set(true);
        break;
      case 'windowClosed':
        this.isPopoutOpen.set(false);
        this.popoutWindow = null;
        this.stopWindowCheck();
        break;
    }
  }

  private startWindowCheck(): void {
    this.stopWindowCheck();
    this.windowCheckTimer = setInterval(() => {
      if (this.popoutWindow && this.popoutWindow.closed) {
        this.isPopoutOpen.set(false);
        this.popoutWindow = null;
        this.stopWindowCheck();
      }
    }, WINDOW_CHECK_INTERVAL);
  }

  private stopWindowCheck(): void {
    if (this.windowCheckTimer !== null) {
      clearInterval(this.windowCheckTimer);
      this.windowCheckTimer = null;
    }
  }
}
