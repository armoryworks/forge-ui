import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { UserPreferencesService } from '../../../shared/services/user-preferences.service';
import { DashboardTask } from '../models/dashboard-task.model';

const TOP3_PREF_KEY = 'dashboard:top3-tomorrow';

@Component({
  selector: 'app-todays-tasks-widget',
  standalone: true,
  imports: [AvatarComponent, StatusBadgeComponent, EmptyStateComponent],
  templateUrl: './todays-tasks-widget.component.html',
  styleUrl: './todays-tasks-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodaysTasksWidgetComponent {
  private readonly router = inject(Router);
  private readonly userPreferences = inject(UserPreferencesService);

  readonly tasks = input.required<DashboardTask[]>();

  protected readonly overdueTasks = computed(() =>
    this.tasks().filter(t => t.statusColor === 'overdue')
  );

  protected readonly priorityTasks = computed(() => {
    const all = this.tasks();
    // Sort: overdue first, then by priority (Critical > High > Medium > Low)
    const priorityOrder: Record<string, number> = {
      overdue: 0,
      active: 1,
      upcoming: 2,
      completed: 3,
    };
    return [...all].sort((a, b) => {
      const aOrder = priorityOrder[a.statusColor] ?? 99;
      const bOrder = priorityOrder[b.statusColor] ?? 99;
      return aOrder - bOrder;
    });
  });

  protected readonly top3Tomorrow = computed(() => {
    return this.userPreferences.get<string[]>(TOP3_PREF_KEY) ?? [];
  });

  protected viewJob(task: DashboardTask): void {
    this.router.navigate(['/kanban'], { queryParams: { jobId: task.jobNumber } });
  }
}
