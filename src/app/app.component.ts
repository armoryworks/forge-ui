import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from './core/layout/app-header.component';
import { SidebarComponent } from './core/layout/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConnectionBannerComponent } from './shared/components/connection-banner/connection-banner.component';
import { AuthService } from './shared/services/auth.service';
import { SignalrService } from './shared/services/signalr.service';
import { NotificationHubService } from './shared/services/notification-hub.service';
import { NotificationService } from './shared/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, SidebarComponent, ToastContainerComponent, ConnectionBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly signalr = inject(SignalrService);
  private readonly notificationHub = inject(NotificationHubService);
  private readonly notificationService = inject(NotificationService);

  protected readonly showShell = computed(() => this.authService.isAuthenticated());

  constructor() {
    // Disconnect all hubs when user logs out
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.signalr.stopAll();
      }
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.notificationHub.connect();
      this.notificationService.load();
    }
  }

  ngOnDestroy(): void {
    this.signalr.stopAll();
  }
}
