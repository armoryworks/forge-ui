import { Injectable, inject } from '@angular/core';

import { PlatformService } from './platform.service';

/**
 * Never silent: a decode gets a haptic + audible tick, a failure or unknown
 * code gets a distinct double-buzz. Native haptics through Capacitor; the
 * audible cue is a short WebAudio tone so it works with the phone muted
 * except for media.
 */
@Injectable({ providedIn: 'root' })
export class ScanFeedbackService {
  private readonly platform = inject(PlatformService);
  private audio: AudioContext | null = null;

  async tick(): Promise<void> {
    this.tone(1200, 60);
    if (this.platform.isNative) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined);
    }
  }

  async doubleBuzz(): Promise<void> {
    this.tone(300, 120);
    setTimeout(() => this.tone(300, 120), 180);
    if (this.platform.isNative) {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      await Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);
    } else if ('vibrate' in navigator) {
      navigator.vibrate([120, 80, 120]);
    }
  }

  private tone(frequency: number, ms: number): void {
    try {
      this.audio ??= new AudioContext();
      const osc = this.audio.createOscillator();
      const gain = this.audio.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + ms / 1000);
    } catch {
      // No audio device — the haptic still fires.
    }
  }
}
