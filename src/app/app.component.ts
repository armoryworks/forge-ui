import { ChangeDetectionStrategy, Component, NgZone, computed, effect, inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
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
import { TrainingService } from './features/training/services/training.service';
import { WalkthroughContent } from './features/training/models/walkthrough-content.model';
import { DriverStep } from './shared/services/help-tour.service';
import { createTourSvg, clearTourConnector, updateTourConnector, attachScrollRefresh, setupPopoverDraggable } from './shared/utils/tour-connector.utils';
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
  private readonly trainingService = inject(TrainingService);
  private readonly ngZone = inject(NgZone);
  private readonly dialog = inject(MatDialog);

  /** Prevents double-launching an inline tour on direct ?walkthrough= navigation. */
  private walkthroughRunning = false;

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
        // Don't stop the scanner on display/kiosk routes — they manage their own scanner lifecycle
        if (!this.layout.isDisplayRoute()) {
          this.scanner.stop();
        }
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
    this.watchWalkthroughUrl();
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

  /**
   * Resumes tours on page reload / direct URL entry.
   *
   * `?tutorial=<id>` — HelpTourService (contextual help tours from the header AI panel)
   * `?walkthrough=<moduleId>` — inline driver.js (training module walkthroughs).
   *   Training-module.component handles the normal start flow; this method handles
   *   direct navigation to `<targetPage>?walkthrough=<id>` without going through the
   *   training UI first.
   */
  private watchWalkthroughUrl(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        const url = this.router.parseUrl((e as NavigationEnd).urlAfterRedirects ?? (e as NavigationEnd).url);
        if (!this.authService.isAuthenticated()) return;

        // ── ?tutorial= — contextual help tours ──────────────────────────────
        const tutorialParam = url.queryParams['tutorial'];
        if (tutorialParam) {
          const moduleId = Number(tutorialParam);
          if (!isNaN(moduleId) && !this.helpTours.isRunning) {
            setTimeout(() => {
              if (this.helpTours.isRunning) return;
              this.trainingService.getModule(moduleId).subscribe({
                next: module => {
                  if (module.contentType !== 'Walkthrough') return;
                  try {
                    const content = JSON.parse(module.contentJson) as WalkthroughContent;
                    this.helpTours.startSteps(content.steps, tutorialParam);
                  } catch { /* malformed JSON — ignore */ }
                },
              });
            }, 800);
          }
        }

        // ── ?walkthrough= — training module walkthroughs ────────────────────
        const walkthroughParam = url.queryParams['walkthrough'];
        if (walkthroughParam) {
          const moduleId = Number(walkthroughParam);
          if (!isNaN(moduleId)) {
            setTimeout(() => {
              // Skip if training-module.component already launched its own tour
              if (document.querySelector('.driver-popover') || this.walkthroughRunning) return;
              this.trainingService.getModule(moduleId).subscribe({
                next: module => {
                  if (module.contentType !== 'Walkthrough') return;
                  try {
                    const content = JSON.parse(module.contentJson) as WalkthroughContent;
                    this.startInlineWalkthrough(content.steps, moduleId);
                  } catch { /* malformed JSON — ignore */ }
                },
              });
            }, 800);
          }
        }
      });
  }

  /**
   * Starts an inline driver.js walkthrough tour without navigating.
   * Used when resuming a training walkthrough from a direct URL or page reload.
   */
  private startInlineWalkthrough(steps: DriverStep[], moduleId: number): void {
    this.walkthroughRunning = true;
    const svg = createTourSvg();
    document.body.appendChild(svg);
    const removeScrollRefresh = attachScrollRefresh(svg);
    const router = this.router;
    const trainingService = this.trainingService;
    const ngZone = this.ngZone;

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.walkthroughRunning = false;
      removeScrollRefresh();
      svg.remove();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    import('driver.js').then(({ driver }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = (driver as any)({
        animate: true,
        overlayOpacity: 0,
        popoverOffset: 20,
        allowClose: true,
        popoverClass: 'qb-tour-popover',
        doneBtnText: '<span class="material-icons-outlined" aria-hidden="true">check</span>Done',
        onHighlighted: () => {
          requestAnimationFrame(() => {
            updateTourConnector(svg, { center: true });
            setupPopoverDraggable();
          });
        },
        onDeselected: () => {
          clearTourConnector(svg);
        },
        onNextClick: () => {
          if (d.hasNextStep()) {
            d.moveNext();
          } else {
            cleanup();
            ngZone.run(() => {
              trainingService.completeModule(moduleId).subscribe({
                error: () => { /* swallow — navigation proceeds regardless */ },
              });
              router.navigateByUrl(`/training/module/${moduleId}`);
            });
            setTimeout(() => d.destroy(), 0);
          }
        },
        onDestroyed: () => {
          cleanup();
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d.setSteps(steps as any);
      d.drive();
    }).catch(() => { /* driver.js not available */ });
  }

  private registerTours(): void {
    [KANBAN_TOUR, DASHBOARD_TOUR, PARTS_TOUR, INVENTORY_TOUR,
     EXPENSES_TOUR, TIME_TRACKING_TOUR, REPORTS_TOUR, ADMIN_TOUR, PLANNING_TOUR]
      .forEach(t => this.helpTours.register(t));
  }
}
