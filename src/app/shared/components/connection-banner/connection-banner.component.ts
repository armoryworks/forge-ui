import {
  ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal,
} from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { SignalrService } from '../../services/signalr.service';

/** Don't show the banner during initial app load. */
const STARTUP_GRACE_MS = 10_000;

/** Only show the banner after the connection has been down for this long. */
const DEBOUNCE_MS = 5_000;

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  templateUrl: './connection-banner.component.html',
  styleUrl: './connection-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionBannerComponent implements OnInit, OnDestroy {
  private readonly signalr = inject(SignalrService);
  private readonly translate = inject(TranslateService);
  private readonly startupReady = signal(false);
  private readonly dismissed = signal(false);

  /** Becomes true only after connection has been down for DEBOUNCE_MS. */
  private readonly debouncedDisconnected = signal(false);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly state = this.signalr.connectionState;

  protected readonly message = computed(() => {
    switch (this.state()) {
      case 'reconnecting': return this.translate.instant('shared.reconnecting');
      case 'disconnected': return this.translate.instant('shared.connectionLost');
      default: return '';
    }
  });

  protected readonly visible = computed(() => {
    if (!this.startupReady()) return false;
    if (this.dismissed()) return false;
    if (!this.signalr.hasEverConnected()) return false;
    return this.debouncedDisconnected();
  });

  constructor() {
    // Debounce disconnection state to avoid flashing banner on brief blips
    effect(() => {
      const state = this.state();
      if (state === 'connected') {
        // Immediately clear — connection is back
        this.clearDebounceTimer();
        this.debouncedDisconnected.set(false);
        this.dismissed.set(false);
      } else if (state === 'reconnecting' || state === 'disconnected') {
        // Start debounce timer — only show banner if still disconnected after delay
        if (!this.debounceTimer && !this.debouncedDisconnected()) {
          this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.debouncedDisconnected.set(true);
          }, DEBOUNCE_MS);
        }
      }
    });
  }

  ngOnInit(): void {
    setTimeout(() => this.startupReady.set(true), STARTUP_GRACE_MS);
  }

  ngOnDestroy(): void {
    this.clearDebounceTimer();
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }

  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
