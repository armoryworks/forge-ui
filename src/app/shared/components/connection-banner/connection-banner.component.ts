import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { SignalrService } from '../../services/signalr.service';

@Component({
  selector: 'app-connection-banner',
  standalone: true,
  templateUrl: './connection-banner.component.html',
  styleUrl: './connection-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectionBannerComponent {
  private readonly signalr = inject(SignalrService);

  protected readonly state = this.signalr.connectionState;

  protected readonly message = computed(() => {
    switch (this.state()) {
      case 'reconnecting': return 'Reconnecting...';
      case 'disconnected': return 'Connection lost. Retrying...';
      default: return '';
    }
  });

  protected readonly visible = computed(
    () => this.state() === 'reconnecting' || this.state() === 'disconnected'
  );
}
