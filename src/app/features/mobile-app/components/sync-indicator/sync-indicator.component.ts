import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';

import { DatePipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { OfflineQueueEntry } from '../../../../shared/models/offline-queue-entry.model';
import { OfflineQueueService } from '../../../../shared/services/offline-queue.service';

type SyncState = 'online' | 'offline' | 'syncing' | 'rejected';

/**
 * Header chip: nothing while online and clean; a count while offline with
 * queued changes; a spinner while draining; a warning when the server
 * refused a replay. Tapping opens the list of what is waiting or failed.
 */
@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './sync-indicator.component.html',
  styleUrl: './sync-indicator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncIndicatorComponent {
  private readonly queue = inject(OfflineQueueService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly online = signal(navigator.onLine);
  protected readonly open = signal(false);
  protected readonly pending = signal<OfflineQueueEntry[]>([]);
  protected readonly pendingCount = this.queue.pendingCount;
  protected readonly rejected = this.queue.rejected;

  protected readonly state = computed<SyncState>(() => {
    if (this.queue.syncing()) return 'syncing';
    if (this.rejected().length > 0) return 'rejected';
    if (!this.online()) return 'offline';
    return 'online';
  });

  protected readonly visible = computed(() =>
    this.state() !== 'online' || this.pendingCount() > 0);

  protected readonly icon = computed(() => {
    switch (this.state()) {
      case 'syncing': return 'sync';
      case 'rejected': return 'warning';
      case 'offline': return 'cloud_off';
      default: return 'cloud_queue';
    }
  });

  constructor() {
    const onOnline = () => this.online.set(true);
    const onOffline = () => this.online.set(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });
  }

  protected async toggle(): Promise<void> {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.pending.set(await this.queue.listPending());
    this.open.set(true);
  }

  protected dismiss(id: string): void {
    this.queue.dismissRejected(id);
    if (this.rejected().length === 0 && this.pendingCount() === 0) this.open.set(false);
  }

  protected async discard(id: string): Promise<void> {
    await this.queue.remove(id);
    this.pending.set(await this.queue.listPending());
  }

  protected retry(): void {
    void this.queue.drain();
  }
}
