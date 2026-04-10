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
  template: `
    <div class="mobile-page" [appLoadingBlock]="loading()">
      <h2 class="mobile-page__title">My Jobs</h2>

      @if (jobs().length > 0) {
        <div class="job-list">
          @for (job of jobs(); track job.id) {
            <a class="job-item" [routerLink]="['/m/jobs', job.id]">
              <div class="job-item__stripe" [style.background-color]="job.stageColor"></div>
              <div class="job-item__content">
                <div class="job-item__header">
                  <span class="job-item__number">{{ job.jobNumber }}</span>
                  @if (job.isOverdue) {
                    <span class="job-item__overdue">Overdue</span>
                  }
                </div>
                <div class="job-item__title">{{ job.title }}</div>
                <div class="job-item__meta">
                  <span class="chip" [style.--chip-color]="job.stageColor">{{ job.stageName }}</span>
                  <span class="job-item__priority">{{ job.priorityName }}</span>
                </div>
              </div>
              <span class="material-icons-outlined job-item__chevron">chevron_right</span>
            </a>
          }
        </div>
      } @else {
        <app-empty-state icon="work" message="No jobs assigned to you" />
      }
    </div>
  `,
  styles: `
    @use 'styles/variables' as *;

    .mobile-page {
      padding: $sp-lg;

      &__title {
        font-size: $font-size-lg;
        font-weight: 600;
        margin: 0 0 $sp-lg;
      }
    }

    .job-list {
      display: flex;
      flex-direction: column;
      gap: $sp-md;
    }

    .job-item {
      display: flex;
      align-items: center;
      gap: $sp-md;
      padding: $sp-md $sp-lg;
      border: 1px solid var(--border);
      background: var(--surface);
      text-decoration: none;
      color: var(--text);
      transition: border-color 150ms ease;

      &:hover { border-color: var(--primary); }

      &__stripe {
        width: 4px;
        align-self: stretch;
        flex-shrink: 0;
      }

      &__content { flex: 1; min-width: 0; }

      &__header {
        display: flex;
        align-items: center;
        gap: $sp-md;
      }

      &__number {
        font-family: $font-family-mono;
        font-size: $font-size-xs;
        color: var(--text-muted);
      }

      &__overdue {
        font-size: $font-size-xxs;
        color: var(--error);
        font-weight: 600;
      }

      &__title {
        font-size: $font-size-base;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__meta {
        display: flex;
        align-items: center;
        gap: $sp-md;
        margin-top: $sp-sm;
      }

      &__priority {
        font-size: $font-size-xxs;
        color: var(--text-muted);
      }

      &__chevron {
        font-size: $icon-size-lg;
        color: var(--text-muted);
        flex-shrink: 0;
      }
    }
  `,
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
