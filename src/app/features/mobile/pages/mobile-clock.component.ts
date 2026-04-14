import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ClockEventTypeService, ClockEventTypeDef } from '../../../shared/services/clock-event-type.service';

interface ClockStatus {
  isClockedIn: boolean;
  status: string;
  clockedInAt: string | null;
}

type ClockAction = ClockEventTypeDef;

@Component({
  selector: 'app-mobile-clock',
  standalone: true,
  imports: [DatePipe, LoadingBlockDirective],
  templateUrl: './mobile-clock.component.html',
  styleUrl: './mobile-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileClockComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly snackbar = inject(SnackbarService);
  protected readonly clockTypes = inject(ClockEventTypeService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly status = signal<ClockStatus | null>(null);

  protected readonly actions = signal<ClockAction[]>([]);

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
    this.http.get<ClockStatus>(`/api/v1/shop-floor/clock-status/${userId}`).subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected submitClock(action: ClockAction): void {
    const userId = this.user()?.id;
    if (!userId || this.submitting()) return;

    this.submitting.set(true);
    this.http.post('/api/v1/shop-floor/clock', {
      userId,
      eventType: action.code,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackbar.success(action.label + ' recorded');
        this.loadStatus();
      },
      error: () => {
        this.submitting.set(false);
        this.snackbar.error('Failed to record clock event');
      },
    });
  }

  protected get statusLabel(): string {
    return this.clockTypes.getLabel(this.status()?.status);
  }
}
