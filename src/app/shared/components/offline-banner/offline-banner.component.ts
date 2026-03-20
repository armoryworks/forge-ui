import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { OfflineQueueService } from '../../services/offline-queue.service';

type BannerState = 'hidden' | 'offline' | 'syncing' | 'synced';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  templateUrl: './offline-banner.component.html',
  styleUrl: './offline-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineBannerComponent implements OnDestroy {
  private readonly offlineQueue = inject(OfflineQueueService);
  private readonly translate = inject(TranslateService);
  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isOffline = signal(!navigator.onLine);
  protected readonly pendingCount = this.offlineQueue.pendingCount;
  protected readonly syncing = this.offlineQueue.syncing;

  protected readonly state = computed<BannerState>(() => {
    if (this.syncing()) {
      return 'syncing';
    }
    if (this.isOffline()) {
      return 'offline';
    }
    if (this.showSyncedMessage()) {
      return 'synced';
    }
    return 'hidden';
  });

  protected readonly visible = computed(() => this.state() !== 'hidden');

  protected readonly showSyncedMessage = signal(false);

  protected readonly message = computed(() => {
    switch (this.state()) {
      case 'offline': {
        const count = this.pendingCount();
        if (count > 0) {
          return this.translate.instant('shared.offlineWithPending', { count });
        }
        return this.translate.instant('shared.offlineNoChanges');
      }
      case 'syncing': {
        const count = this.pendingCount();
        return this.translate.instant('shared.syncing', { count });
      }
      case 'synced':
        return this.translate.instant('shared.allChangesSynced');
      default:
        return '';
    }
  });

  protected readonly icon = computed(() => {
    switch (this.state()) {
      case 'offline': return 'cloud_off';
      case 'syncing': return 'sync';
      case 'synced': return 'cloud_done';
      default: return '';
    }
  });

  private readonly onlineHandler = (): void => {
    this.isOffline.set(false);
  };

  private readonly offlineHandler = (): void => {
    this.isOffline.set(true);
    this.showSyncedMessage.set(false);
    this.clearAutoDismiss();
  };

  constructor() {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Watch for sync completion to show success message
    effect(() => {
      const result = this.offlineQueue.lastSyncResult();
      if (result && result.success && result.processed > 0 && !this.isOffline()) {
        this.showSyncedMessage.set(true);
        this.clearAutoDismiss();
        this.autoDismissTimer = setTimeout(() => {
          this.showSyncedMessage.set(false);
        }, 3000);
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
    this.clearAutoDismiss();
  }

  private clearAutoDismiss(): void {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }
}
