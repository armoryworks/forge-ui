import {
  ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal,
} from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { SignalrService } from '../../services/signalr.service';

const STARTUP_GRACE_MS = 8_000;

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  templateUrl: './connection-banner.component.html',
  styleUrl: './connection-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionBannerComponent implements OnInit {
  private readonly signalr = inject(SignalrService);
  private readonly translate = inject(TranslateService);
  private readonly startupReady = signal(false);
  private readonly dismissed = signal(false);

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
    return this.state() === 'reconnecting' || this.state() === 'disconnected';
  });

  constructor() {
    // Auto-clear dismissed state when connection recovers
    effect(() => {
      if (this.state() === 'connected') {
        this.dismissed.set(false);
      }
    });
  }

  ngOnInit(): void {
    setTimeout(() => this.startupReady.set(true), STARTUP_GRACE_MS);
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}
