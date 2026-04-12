import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../shared/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

interface MobileJob {
  id: number;
  jobNumber: string;
  title: string;
  stageName: string;
  stageColor: string;
  priorityName: string;
  isOverdue: boolean;
  hasActiveTimer: boolean;
}

@Component({
  selector: 'app-mobile-jobs',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './mobile-jobs.component.html',
  styleUrl: './mobile-jobs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileJobsComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(true);
  protected readonly jobs = signal<MobileJob[]>([]);

  ngOnInit(): void {
    const userId = this.authService.user()?.id;
    if (!userId) return;

    this.http.get<{ data: MobileJob[] }>('/api/v1/jobs', {
      params: { assigneeId: userId.toString(), pageSize: '50' },
    }).subscribe({
      next: (result) => {
        this.jobs.set(result.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
