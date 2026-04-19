import { Injectable, inject, signal } from '@angular/core';

import { UserPreferencesService } from './user-preferences.service';
import { LayoutService } from './layout.service';
import { ChatMessageEvent } from '../../features/chat/models/chat-message-event.model';

export type ChatSoundType = 'default' | 'chime' | 'bell' | 'pop';

const SOUND_PROFILES: Record<ChatSoundType, { frequency: number; frequency2: number; duration: number; waveform: OscillatorType }> = {
  default: { frequency: 880, frequency2: 1320, duration: 0.12, waveform: 'sine' },
  chime:   { frequency: 1047, frequency2: 1319, duration: 0.15, waveform: 'sine' },
  bell:    { frequency: 660, frequency2: 880, duration: 0.2, waveform: 'triangle' },
  pop:     { frequency: 520, frequency2: 780, duration: 0.08, waveform: 'square' },
};
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

  get previewPopupEnabled(): boolean {
    return this.prefs.get<boolean>('chat:preview_popup') ?? true;
  }

  get soundType(): ChatSoundType {
    return this.prefs.get<ChatSoundType>('chat:sound_type') ?? 'default';
  }

  setSoundEnabled(enabled: boolean): void {
    this.prefs.set('chat:sound', enabled);
  }

  setVibrateEnabled(enabled: boolean): void {
    this.prefs.set('chat:vibrate', enabled);
  }

  setPreviewPopupEnabled(enabled: boolean): void {
    this.prefs.set('chat:preview_popup', enabled);
  }

  setSoundType(type: ChatSoundType): void {
    this.prefs.set('chat:sound_type', type);
  }

  /**
   * Called when a chat message arrives from another user.
   * Plays chime, vibrates, and emits for preview popup (respecting preferences).
   */
  notifyIncomingMessage(event: ChatMessageEvent): void {
    if (this.previewPopupEnabled) {
      this.latestIncomingMessage.set(event);
    }

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

      const profile = SOUND_PROFILES[this.soundType] ?? SOUND_PROFILES['default'];

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = profile.waveform;
      oscillator.frequency.setValueAtTime(profile.frequency, ctx.currentTime);
      oscillator.frequency.setValueAtTime(profile.frequency2, ctx.currentTime + profile.duration);

      gainNode.gain.setValueAtTime(CHIME_VOLUME, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + profile.duration * 2);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + profile.duration * 2);
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
