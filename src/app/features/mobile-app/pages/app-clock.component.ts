import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DatePipe } from '@angular/common';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ClockState, isQueued } from '../../../shared/models/mobile-api.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { OfflineQueueService } from '../../../shared/services/offline-queue.service';
import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { UndoService } from '../../../shared/services/undo.service';
import { IdentityPromptComponent } from '../identity/identity-prompt.component';

type Punch = 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd';

/**
 * Clock: current status in huge type, one button whose label follows the
 * state, a break button when clocked in. Every punch shows an undo toast.
 * On a shared device a badge scan or PIN identifies the person first.
 */
@Component({
  selector: 'app-app-clock',
  standalone: true,
  imports: [DatePipe, TranslatePipe, IdentityPromptComponent],
  templateUrl: './app-clock.component.html',
  styleUrl: './app-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppClockComponent {
  private readonly api = inject(MobileApiService);
  private readonly undo = inject(UndoService);
  private readonly queue = inject(OfflineQueueService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly identity = inject(SharedIdentityService);
  protected readonly instances = inject(InstanceService);

  protected readonly state = signal<ClockState | null>(null);
  protected readonly busy = signal(false);
  protected readonly identifying = signal(false);
  protected readonly person = this.identity.person;

  protected readonly shared = computed(() => !!this.instances.instance()?.shared);
  protected readonly needsIdentity = computed(() => this.shared() && !this.identity.identified());

  protected readonly primaryPunch = computed<Punch>(() => {
    switch (this.state()?.state) {
      case 'in': return 'ClockOut';
      case 'break': return 'BreakEnd';
      default: return 'ClockIn';
    }
  });

  private pendingPunch: Punch | null = null;

  constructor() {
    if (!this.needsIdentity()) this.load();
  }

  protected load(): void {
    this.api.clockState().subscribe({
      next: (state) => {
        this.state.set(state);
        this.cache(state);
      },
      error: () => this.state.set(this.cached()),
    });
  }

  private cacheKey(): string {
    return `forge-mobile-clock:${this.instances.instance()?.id ?? 'default'}`;
  }

  private cache(state: ClockState): void {
    try { localStorage.setItem(this.cacheKey(), JSON.stringify(state)); } catch { /* best effort */ }
  }

  private cached(): ClockState | null {
    try {
      const raw = localStorage.getItem(this.cacheKey());
      return raw ? JSON.parse(raw) as ClockState : null;
    } catch {
      return null;
    }
  }

  private stateAfter(kind: Punch): ClockState {
    const next = kind === 'ClockOut' ? 'out' : kind === 'BreakStart' ? 'break' : 'in';
    return { state: next, lastEventType: kind, lastEventAt: new Date().toISOString(), lastEventId: null };
  }

  protected punch(kind: Punch): void {
    if (this.needsIdentity()) {
      this.pendingPunch = kind;
      this.identifying.set(true);
      return;
    }
    void this.doPunch(kind);
  }

  protected identify(): void {
    this.identifying.set(true);
  }

  protected onIdentified(): void {
    this.identifying.set(false);
    this.load();
    const kind = this.pendingPunch;
    this.pendingPunch = null;
    if (kind) void this.doPunch(kind);
  }

  protected onIdentityCancelled(): void {
    this.identifying.set(false);
    this.pendingPunch = null;
  }

  private async doPunch(kind: Punch): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.clockPunch(kind));
      if (isQueued(result)) {
        const before = this.state();
        const optimistic = this.stateAfter(kind);
        this.state.set(optimistic);
        this.cache(optimistic);
        this.undo.offer(this.translate.instant('mobileApp.offline.queued'), async () => {
          await this.queue.remove(result.entryId);
          this.state.set(before);
          if (before) this.cache(before);
        });
      } else {
        this.state.set(result.state);
        this.cache(result.state);
        this.undo.offer(
          this.translate.instant(`mobileApp.clock.done.${kind}`),
          async () => {
            const reverted = await firstValueFrom(this.api.undoClockPunch(result.eventId));
            if (!isQueued(reverted)) {
              this.state.set(reverted);
              this.cache(reverted);
            }
          },
        );
      }
      if (this.shared()) this.identity.clear();
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.clock.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
