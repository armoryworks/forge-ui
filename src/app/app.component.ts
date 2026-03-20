import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AppHeaderComponent } from './core/layout/app-header.component';
import { SidebarComponent } from './core/layout/sidebar.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConnectionBannerComponent } from './shared/components/connection-banner/connection-banner.component';
import { OnboardingBannerComponent } from './shared/components/onboarding-banner/onboarding-banner.component';
import { OfflineBannerComponent } from './shared/components/offline-banner/offline-banner.component';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { KeyboardShortcutsHelpComponent } from './shared/components/keyboard-shortcuts-help/keyboard-shortcuts-help.component';
import { SyncConflictDialogComponent, SyncConflictDialogData } from './shared/components/sync-conflict-dialog/sync-conflict-dialog.component';
import { SyncConflict, SyncConflictResolution } from './shared/models/sync-conflict.model';
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
import { LanguageService } from './shared/services/language.service';
import { ScannerService } from './shared/services/scanner.service';
import { OfflineQueueService } from './shared/services/offline-queue.service';
import { EmployeeProfileService } from './features/account/services/employee-profile.service';
import { KANBAN_TOUR } from './shared/tours/kanban-tour';
import { DASHBOARD_TOUR } from './shared/tours/dashboard-tour';
import { PARTS_TOUR } from './shared/tours/parts-tour';
import { INVENTORY_TOUR } from './shared/tours/inventory-tour';
import { EXPENSES_TOUR } from './shared/tours/expenses-tour';
import { TIME_TRACKING_TOUR } from './shared/tours/time-tracking-tour';
import { REPORTS_TOUR } from './shared/tours/reports-tour';
import { ADMIN_TOUR } from './shared/tours/admin-tour';
import { PLANNING_TOUR } from './shared/tours/planning-tour';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, AppHeaderComponent, SidebarComponent, ToastContainerComponent, ConnectionBannerComponent, OnboardingBannerComponent, OfflineBannerComponent, LoadingOverlayComponent, KeyboardShortcutsHelpComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
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
  private readonly languageService = inject(LanguageService);
  private readonly scanner = inject(ScannerService);
  private readonly offlineQueue = inject(OfflineQueueService);
  private readonly employeeProfile = inject(EmployeeProfileService);
  private readonly dialog = inject(MatDialog);

  protected readonly showShell = computed(() => this.authService.isAuthenticated() && !this.layout.isDisplayRoute() && !this.layout.isAuthRoute());
  protected readonly isGlobalLoading = this.loadingService.isLoading;

  constructor() {
    // Reactively connect/disconnect hubs based on auth state
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.notificationHub.connect();
        this.chatHub.connect();
        this.notificationService.load();
        this.userPreferences.load();
        this.accountingService.load();
        this.employeeProfile.load();
        this.scanner.start();
      } else {
        this.signalr.stopAll();
        this.scanner.stop();
        // Redirect to login when auth is lost (expired token, logout, etc.)
        // Use setTimeout to break out of the reactive context — router.navigate
        // triggers signal changes that conflict with effect execution.
        if (!this.layout.isAuthRoute() && !this.layout.isDisplayRoute()) {
          setTimeout(() => this.router.navigate(['/login']));
        }
      }
    });

    // Watch for sync conflicts and open resolution dialog
    effect(() => {
      const conflict = this.offlineQueue.conflict();
      if (conflict) {
        this.openConflictDialog(conflict);
      }
    });
  }

  ngOnInit(): void {
    this.routeLoading.initialize();
    this.broadcast.initialize();
    this.languageService.initialize();
    this.themeService.loadBrandSettings();
    this.registerTours();
    this.keyboardShortcuts.initialize();
  }

  ngOnDestroy(): void {
    this.signalr.stopAll();
    this.keyboardShortcuts.destroy();
    this.scanner.stop();
  }

  private openConflictDialog(conflict: SyncConflict): void {
    this.dialog.open<SyncConflictDialogComponent, SyncConflictDialogData, SyncConflictResolution>(
      SyncConflictDialogComponent,
      {
        width: '520px',
        disableClose: true,
        data: { conflict },
      }
    ).afterClosed().subscribe(resolution => {
      switch (resolution) {
        case 'keep-mine':
          this.offlineQueue.resolveConflictKeepMine(conflict.entryId);
          break;
        case 'keep-server':
          this.offlineQueue.resolveConflictKeepServer(conflict.entryId);
          break;
        default:
          this.offlineQueue.resolveConflictCancel();
          break;
      }
    });
  }

  private registerTours(): void {
    [KANBAN_TOUR, DASHBOARD_TOUR, PARTS_TOUR, INVENTORY_TOUR,
     EXPENSES_TOUR, TIME_TRACKING_TOUR, REPORTS_TOUR, ADMIN_TOUR, PLANNING_TOUR]
      .forEach(t => this.helpTours.register(t));
  }
}
