import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../../shared/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ClockEventTypeService } from '../../../shared/services/clock-event-type.service';

interface MobileClockStatus {
  isClockedIn: boolean;
  clockedInAt: string | null;
  status: string;
  currentJobNumber: string | null;
  timeOnTask: string;
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  In: 'mobileLegacyPages.home.statusWorking',
  Out: 'mobileLegacyPages.home.statusClockedOut',
  OnBreak: 'mobileLegacyPages.home.statusOnBreak',
  OnLunch: 'mobileLegacyPages.home.statusOnLunch',
};

interface MobileJobSummary {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  hasActiveTimer: boolean;
}

@Component({
  selector: 'app-mobile-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './mobile-home.component.html',
  styleUrl: './mobile-home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileHomeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  protected readonly clockTypes = inject(ClockEventTypeService);

  protected readonly user = this.authService.user;
  protected readonly loading = signal(true);
  protected readonly clockStatus = signal<MobileClockStatus | null>(null);
  protected readonly activeJobs = signal<MobileJobSummary[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    const userId = this.user()?.id;
    if (!userId) return;

    // Load clock status
    this.http.get<MobileClockStatus>('/api/v1/time-tracking/clock-status').subscribe({
      next: (status) => this.clockStatus.set(status),
      error: () => this.clockStatus.set(null),
    });

    // Load active jobs — Phase 3 F7-broad / WU-22 — server returns the
    // standard paged envelope ({ items, totalCount, page, pageSize }).
    this.http.get<{ items: MobileJobSummary[] }>('/api/v1/jobs', {
      params: { assigneeId: userId.toString(), pageSize: '5' },
    }).subscribe({
      next: (result) => {
        this.activeJobs.set(result.items ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected get greetingKey(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'mobileLegacyPages.home.greetingMorning';
    if (hour < 17) return 'mobileLegacyPages.home.greetingAfternoon';
    return 'mobileLegacyPages.home.greetingEvening';
  }

  protected get statusLabelKey(): string | null {
    const status = this.clockStatus();
    if (!status) return 'mobileLegacyPages.home.notClockedIn';
    if (!status.status) return STATUS_LABEL_KEYS['Out'];
    const known = STATUS_LABEL_KEYS[status.status];
    if (known) return known;
    if (this.clockTypes.definitions().some((d) => d.statusMapping === status.status)) return null;
    return 'mobileLegacyPages.home.statusUnknown';
  }

  protected get statusClass(): string {
    const status = this.clockStatus();
    return 'status--' + this.clockTypes.getStatusCssClass(status?.status);
  }
}
