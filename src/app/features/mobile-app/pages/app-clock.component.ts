import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DatePipe } from '@angular/common';

import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ClockState } from '../../../shared/models/mobile-api.model';
import { InstanceService } from '../../../shared/services/instance.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
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
      next: (state) => this.state.set(state),
      error: () => this.state.set(null),
    });
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
      this.state.set(result.state);
      this.undo.offer(
        this.translate.instant(`mobileApp.clock.done.${kind}`),
        async () => {
          const reverted = await firstValueFrom(this.api.undoClockPunch(result.eventId));
          this.state.set(reverted);
        },
      );
      if (this.shared()) this.identity.clear();
    } catch {
      this.snackbar.error(this.translate.instant('mobileApp.clock.failed'));
    } finally {
      this.busy.set(false);
    }
  }
}
