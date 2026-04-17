import { Injectable, inject, signal } from '@angular/core';

import { UserPreferencesService } from './user-preferences.service';
import { LayoutService } from './layout.service';
import { ChatMessageEvent } from '../../features/chat/models/chat-message-event.model';

const CHIME_FREQUENCY = 880;
const CHIME_DURATION = 0.12;
const CHIME_VOLUME = 0.3;

@Injectable({ providedIn: 'root' })
export class ChatNotificationService {
  private readonly prefs = inject(UserPreferencesService);
  private readonly layout = inject(LayoutService);

  private audioContext: AudioContext | null = null;

  /** The most recent incoming message for preview popup consumption. */
  readonly latestIncomingMessage = signal<ChatMessageEvent | null>(null);

  get soundEnabled(): boolean {
    return this.prefs.get<boolean>('chat:sound') ?? true;
  }

  get vibrateEnabled(): boolean {
    return this.prefs.get<boolean>('chat:vibrate') ?? true;
  }

  setSoundEnabled(enabled: boolean): void {
    this.prefs.set('chat:sound', enabled);
  }

  setVibrateEnabled(enabled: boolean): void {
    this.prefs.set('chat:vibrate', enabled);
  }

  /**
   * Called when a chat message arrives from another user.
   * Plays chime, vibrates, and emits for preview popup.
   */
  notifyIncomingMessage(event: ChatMessageEvent): void {
    this.latestIncomingMessage.set(event);

    if (this.soundEnabled) {
      this.playChime();
    }

    if (this.vibrateEnabled && this.layout.isMobile()) {
      this.vibrate();
    }
  }

  /** Clears the latest message after it's been consumed by the preview popup. */
  clearLatest(): void {
    this.latestIncomingMessage.set(null);
  }

  private playChime(): void {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(CHIME_FREQUENCY, ctx.currentTime);
      oscillator.frequency.setValueAtTime(CHIME_FREQUENCY * 1.5, ctx.currentTime + CHIME_DURATION);

      gainNode.gain.setValueAtTime(CHIME_VOLUME, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + CHIME_DURATION * 2);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + CHIME_DURATION * 2);
    } catch {
      // Audio not available — fail silently
    }
  }

  private vibrate(): void {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // Vibration not available
    }
  }
}
