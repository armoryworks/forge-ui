import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ClockEventTypeService, ClockEventTypeDef } from '../../../shared/services/clock-event-type.service';
import { RunningTimer } from '../../../shared/models/running-timer.model';
import { secondTicker } from '../../../shared/utils/second-ticker';
import { MobileClockStateService } from '../services/mobile-clock-state.service';
import { MobileRunningTimersService } from '../services/mobile-running-timers.service';

interface ClockStatus {
  isClockedIn: boolean;
  status: string;
  clockedInAt: string | null;
}

type ClockAction = ClockEventTypeDef;

@Component({
  selector: 'app-mobile-clock',
  standalone: true,
  imports: [DatePipe, TranslatePipe, LoadingBlockDirective],
  templateUrl: './mobile-clock.component.html',
  styleUrl: './mobile-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileClockComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly clockState = inject(MobileClockStateService);
  protected readonly clockTypes = inject(ClockEventTypeService);
  protected readonly runningTimers = inject(MobileRunningTimersService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly status = signal<ClockStatus | null>(null);
  protected readonly now = secondTicker();

  protected readonly actions = signal<ClockAction[]>([]);
  protected readonly timers = this.runningTimers.timers;

  constructor() {
    // Recompute actions whenever clock type definitions load (resolves race condition)
    effect(() => {
      const defs = this.clockTypes.definitions();
      const s = this.status();
      if (defs.length > 0 && s) {
        this.actions.set(this.clockTypes.getAvailableActions(s.status));
      }
    });
  }

  ngOnInit(): void {
    this.clockTypes.load();
    this.loadStatus();
  }

  private loadStatus(): void {
    const userId = this.user()?.id;
    if (!userId) return;

    this.loading.set(true);
    this.runningTimers.load();
    this.http.get<ClockStatus>('/api/v1/time-tracking/clock-status').subscribe({
      next: (s) => {
        this.status.set(s);
        this.clockState.update(s.isClockedIn);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected stopsTimers(action: ClockAction): boolean {
    return action.statusMapping === 'Out' && this.timers().length > 0;
  }

  protected submitClock(action: ClockAction): void {
    const userId = this.user()?.id;
    if (!userId || this.submitting()) return;

    this.submitting.set(true);
    const stopping = this.stopsTimers(action) ? this.timers() : [];
    this.http.post('/api/v1/display/shop-floor/clock', {
      userId,
      eventType: action.code,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(this.recordedMessage(action, stopping));
        this.loadStatus();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error(this.translate.instant('mobileLegacy.clock.recordFailed'));
      },
    });
  }

  private recordedMessage(action: ClockAction, stopped: RunningTimer[]): string {
    if (stopped.length === 0) {
      return this.translate.instant('mobileLegacy.clock.recorded', { action: action.label });
    }
    const jobNumber = stopped.length === 1 ? stopped[0].jobNumber : null;
    return jobNumber
      ? this.translate.instant('mobileLegacy.clock.recordedTimerStopped', { action: action.label, jobNumber })
      : this.translate.instant('mobileLegacy.clock.recordedTimersStopped', { action: action.label });
  }

  protected get statusLabel(): string {
    return this.clockTypes.getLabel(this.status()?.status);
  }
}
