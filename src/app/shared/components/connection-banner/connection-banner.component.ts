import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal,
} from '@angular/core';

import { SignalrService } from '../../services/signalr.service';

const STARTUP_GRACE_MS = 5_000;

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  templateUrl: './connection-banner.component.html',
  styleUrl: './connection-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionBannerComponent implements OnInit {
  private readonly signalr = inject(SignalrService);
  private readonly startupReady = signal(false);

  protected readonly state = this.signalr.connectionState;

  protected readonly message = computed(() => {
    switch (this.state()) {
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Connection lost. Retrying...';
      default: return '';
    }
  });

  protected readonly visible = computed(() => {
    if (!this.startupReady()) return false;
    return this.state() === 'reconnecting' || this.state() === 'disconnected';
  });

  ngOnInit(): void {
    setTimeout(() => this.startupReady.set(true), STARTUP_GRACE_MS);
  }
}
