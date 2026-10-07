import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../shared/services/capability.service';
import { CrashReportingService } from '../../shared/services/crash-reporting.service';
import { AppInfoService } from '../../shared/services/app-info.service';
import { AuthService } from '../../shared/services/auth.service';
import { InstanceService } from '../../shared/services/instance.service';
import { MobileTimerService } from '../../shared/services/mobile-timer.service';
import { OfflineQueueService } from '../../shared/services/offline-queue.service';
import { PlatformService } from '../../shared/services/platform.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { UndoService } from '../../shared/services/undo.service';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';
import { SyncIndicatorComponent } from './components/sync-indicator/sync-indicator.component';

interface MobileAppTab {
  path: string;
  labelKey: string;
  icon: string;
  capability: string;
}

/**
 * Native-shell chrome: top bar + five-tab bottom bar (Scan, Clock, Jobs,
 * Move, Lookup), each tab shown only while its CAP-MOBILE-* flag is on for
 * this instance. Account lives behind the gear, never a tab. While a timer
 * runs, a strip above the tab bar shows it ticking with a Stop button.
 */
@Component({
  selector: 'app-mobile-app-shell',
  standalone: true,
  imports: [SyncIndicatorComponent, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageToggleComponent],
  templateUrl: './mobile-app-shell.component.html',
  styleUrl: './mobile-app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAppShellComponent {
  private readonly capabilities = inject(CapabilityService);
  private readonly crash = inject(CrashReportingService);
  private readonly appInfo = inject(AppInfoService);

  private readonly allTabs: MobileAppTab[] = [
    { path: '/app/scan', labelKey: 'mobileApp.tabs.scan', icon: 'qr_code_scanner', capability: 'CAP-MOBILE-SCAN' },
    { path: '/app/clock', labelKey: 'mobileApp.tabs.clock', icon: 'schedule', capability: 'CAP-MOBILE-CLOCK' },
    { path: '/app/jobs', labelKey: 'mobileApp.tabs.jobs', icon: 'work', capability: 'CAP-MOBILE-JOBS' },
    { path: '/app/move', labelKey: 'mobileApp.tabs.move', icon: 'swap_horiz', capability: 'CAP-MOBILE-STOCK' },
    { path: '/app/lookup', labelKey: 'mobileApp.tabs.lookup', icon: 'search', capability: 'CAP-MOBILE-LOOKUP' },
  ];

  protected readonly tabs = computed(() =>
    this.allTabs.filter((tab) => this.capabilities.isEnabled(tab.capability, true)));

  protected readonly timer = inject(MobileTimerService);
  private readonly timerHub = inject(TimerHubService);
  private readonly queue = inject(OfflineQueueService);
  private readonly auth = inject(AuthService);
  private readonly instances = inject(InstanceService);
  private readonly platform = inject(PlatformService);
  private readonly snackbar = inject(SnackbarService);
  private readonly undo = inject(UndoService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(Date.now());
  protected readonly stopping = signal(false);

  protected readonly runningLabel = computed(() => {
    const running = this.timer.active();
    return running ? this.timer.labelOf(running) : '';
  });

  protected readonly elapsed = computed(() => {
    const running = this.timer.active();
    return running ? this.timer.elapsedOf(running, this.now()) : '';
  });

  private hubStarted = false;

  constructor() {
    void this.appInfo.load();
    void this.crash.init();

    effect(() => {
      const token = this.auth.token();
      untracked(() => {
        void this.timer.refresh();
        if (token) this.listenForTimerEvents();
      });
    });

    effect(() => {
      if (this.queue.lastSyncResult()) untracked(() => void this.timer.refresh());
    });

    effect((onCleanup) => {
      if (!this.timer.active()) return;
      untracked(() => this.now.set(Date.now()));
      const tick = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(tick));
    });

    this.refreshOnResume();
    this.destroyRef.onDestroy(() => this.timerHub.clearCallbacks());
  }

  protected async stopTimer(): Promise<void> {
    if (this.stopping()) return;
    this.stopping.set(true);
    try {
      const outcome = await this.timer.stop();
      this.undo.offer(this.timer.stoppedMessage(outcome.stopped), () => this.timer.undoStop(outcome));
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.jobs.actionFailed'));
    } finally {
      this.stopping.set(false);
    }
  }

  private listenForTimerEvents(): void {
    if (this.hubStarted || this.instances.instance()?.shared) return;
    this.hubStarted = true;
    this.timerHub.onTimerStartedEvent(() => void this.timer.refresh());
    this.timerHub.onTimerStoppedEvent(() => void this.timer.refresh());
    void this.timerHub.connect().catch(() => undefined);
  }

  private refreshOnResume(): void {
    if (this.platform.isNative) {
      let destroyed = false;
      let remove: (() => Promise<void>) | null = null;
      this.destroyRef.onDestroy(() => {
        destroyed = true;
        void remove?.();
      });
      void import('@capacitor/app').then(async ({ App }) => {
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void this.timer.refresh();
        });
        remove = () => handle.remove();
        if (destroyed) void remove();
      });
      return;
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void this.timer.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }
}
