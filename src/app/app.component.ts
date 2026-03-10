import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeaderComponent } from './core/layout/app-header.component';
import { SidebarComponent } from './core/layout/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConnectionBannerComponent } from './shared/components/connection-banner/connection-banner.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { KeyboardShortcutsHelpComponent } from './shared/components/keyboard-shortcuts-help/keyboard-shortcuts-help.component';
import { AuthService } from './shared/services/auth.service';
import { LayoutService } from './shared/services/layout.service';
import { SignalrService } from './shared/services/signalr.service';
import { NotificationHubService } from './shared/services/notification-hub.service';
import { ChatHubService } from './shared/services/chat-hub.service';
import { NotificationService } from './shared/services/notification.service';
import { UserPreferencesService } from './shared/services/user-preferences.service';
import { LoadingService } from './shared/services/loading.service';
import { RouteLoadingService } from './shared/services/route-loading.service';
import { ThemeService } from './shared/services/theme.service';
import { HelpTourService } from './shared/services/help-tour.service';
import { AccountingService } from './shared/services/accounting.service';
import { KeyboardShortcutsService } from './shared/services/keyboard-shortcuts.service';
import { BroadcastService } from './shared/services/broadcast.service';
import { KANBAN_TOUR } from './shared/tours/kanban-tour';
import { DASHBOARD_TOUR } from './shared/tours/dashboard-tour';
import { PARTS_TOUR } from './shared/tours/parts-tour';
import { INVENTORY_TOUR } from './shared/tours/inventory-tour';
import { EXPENSES_TOUR } from './shared/tours/expenses-tour';
import { TIME_TRACKING_TOUR } from './shared/tours/time-tracking-tour';
import { REPORTS_TOUR } from './shared/tours/reports-tour';
import { ADMIN_TOUR } from './shared/tours/admin-tour';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, SidebarComponent, ToastContainerComponent, ConnectionBannerComponent, LoadingOverlayComponent, KeyboardShortcutsHelpComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  private readonly signalr = inject(SignalrService);
  private readonly notificationHub = inject(NotificationHubService);
  private readonly chatHub = inject(ChatHubService);
  private readonly notificationService = inject(NotificationService);
  private readonly userPreferences = inject(UserPreferencesService);
  private readonly loadingService = inject(LoadingService);
  private readonly routeLoading = inject(RouteLoadingService);
  private readonly themeService = inject(ThemeService);
  private readonly helpTours = inject(HelpTourService);
  private readonly accountingService = inject(AccountingService);
  private readonly keyboardShortcuts = inject(KeyboardShortcutsService);
  private readonly broadcast = inject(BroadcastService);

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
    this.broadcast.initialize();
    this.themeService.loadBrandSettings();
    this.registerTours();
    this.keyboardShortcuts.initialize();

    if (this.authService.isAuthenticated()) {
      this.notificationHub.connect();
      this.chatHub.connect();
      this.notificationService.load();
      this.userPreferences.load();
      this.accountingService.load();
    }
  }

  ngOnDestroy(): void {
    this.signalr.stopAll();
    this.keyboardShortcuts.destroy();
  }

  private registerTours(): void {
    [KANBAN_TOUR, DASHBOARD_TOUR, PARTS_TOUR, INVENTORY_TOUR,
     EXPENSES_TOUR, TIME_TRACKING_TOUR, REPORTS_TOUR, ADMIN_TOUR]
      .forEach(t => this.helpTours.register(t));
  }
}
