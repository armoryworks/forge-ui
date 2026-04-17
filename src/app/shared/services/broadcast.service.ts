import { Injectable, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';
import { ThemeService, ThemeMode } from './theme.service';
import { SignalrService } from './signalr.service';

type BroadcastEvent =
  | { type: 'logout' }
  | { type: 'theme-change'; theme: ThemeMode }
  | { type: 'chat-window-opened' }
  | { type: 'chat-window-closed' }
  | { type: 'chat-open-conversation'; channelId?: number; userId?: number };

const CHANNEL_NAME = 'qb-engineer-sync';

@Injectable({ providedIn: 'root' })
export class BroadcastService implements OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly signalr = inject(SignalrService);
  private channel: BroadcastChannel | null = null;

  initialize(): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event: MessageEvent<BroadcastEvent>) => {
      this.handleMessage(event.data);
    };

    // Register broadcast callbacks on source services to avoid circular dependencies
    this.authService.registerBroadcastCallback(() => {
      this.channel?.postMessage({ type: 'logout' } satisfies BroadcastEvent);
    });

    this.themeService.registerBroadcastCallback((theme: ThemeMode) => {
      this.channel?.postMessage({ type: 'theme-change', theme } satisfies BroadcastEvent);
    });
  }

  send(channel: string, data: unknown): void {
    // Generic send for additional channels (e.g., chat sync)
    try {
      const ch = new BroadcastChannel(channel);
      ch.postMessage(data);
      ch.close();
    } catch {
      // BroadcastChannel not supported
    }
  }

  sendChatEvent(event: BroadcastEvent): void {
    this.channel?.postMessage(event);
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.channel = null;
  }

  private handleMessage(event: BroadcastEvent): void {
    switch (event.type) {
      case 'logout':
        this.authService.clearAuth();
        this.signalr.stopAll();
        this.router.navigate(['/login']);
        break;

      case 'theme-change':
        this.themeService.applyThemeFromBroadcast(event.theme);
        break;
    }
  }
}
