import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from './core/layout/app-header.component';
import { SidebarComponent } from './core/layout/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConnectionBannerComponent } from './shared/components/connection-banner/connection-banner.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { AuthService } from './shared/services/auth.service';
import { SignalrService } from './shared/services/signalr.service';
import { NotificationHubService } from './shared/services/notification-hub.service';
import { NotificationService } from './shared/services/notification.service';
import { UserPreferencesService } from './shared/services/user-preferences.service';
import { LoadingService } from './shared/services/loading.service';
import { RouteLoadingService } from './shared/services/route-loading.service';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, SidebarComponent, ToastContainerComponent, ConnectionBannerComponent, LoadingOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly signalr = inject(SignalrService);
  private readonly notificationHub = inject(NotificationHubService);
  private readonly notificationService = inject(NotificationService);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly loadingService = inject(LoadingService);
  private readonly routeLoading = inject(RouteLoadingService);
  private readonly themeService = inject(ThemeService);

  protected readonly showShell = computed(() => this.authService.isAuthenticated());
  protected readonly isGlobalLoading = this.loadingService.isLoading;

  constructor() {
    // Disconnect all hubs when user logs out
    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.signalr.stopAll();
      }
    });
  }

  ngOnInit(): void {
    this.routeLoading.initialize();
    this.themeService.loadBrandSettings();

    if (this.authService.isAuthenticated()) {
      this.notificationHub.connect();
      this.notificationService.load();
      this.userPreferences.load();
    }
  }

  ngOnDestroy(): void {
    this.signalr.stopAll();
  }
}
