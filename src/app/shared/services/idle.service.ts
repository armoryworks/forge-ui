import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
];

@Injectable({ providedIn: 'root' })
export class IdleService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly lastActivity = signal(Date.now());
  private readonly timeoutMs = signal(0);
  private readonly tick = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly isIdle = computed(() => {
    const ms = this.timeoutMs();
    if (ms <= 0) return false;
    return this.tick() - this.lastActivity() >= ms;
  });

  private readonly onActivity = (): void => {
    this.lastActivity.set(Date.now());
  };

  constructor() {
    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, this.onActivity, { passive: true, capture: true });
    }
    this.destroyRef.onDestroy(() => {
      for (const ev of ACTIVITY_EVENTS) {
        document.removeEventListener(ev, this.onActivity, { capture: true } as EventListenerOptions);
      }
      if (this.timer) clearInterval(this.timer);
    });
  }

  configure(ms: number): void {
    this.timeoutMs.set(ms);
    this.lastActivity.set(Date.now());

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (ms > 0) {
      this.timer = setInterval(() => this.tick.set(Date.now()), 1000);
    }
  }

  reset(): void {
    this.lastActivity.set(Date.now());
    this.tick.set(Date.now());
  }
}
