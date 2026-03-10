import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { WorkerService } from './services/worker.service';
import { WorkerTask } from './models/worker-task.model';
import { AuthService } from '../../shared/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-worker',
  standalone: true,
  imports: [DatePipe, AvatarComponent, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './worker.component.html',
  styleUrl: './worker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkerComponent {
  private readonly workerService = inject(WorkerService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly tasks = signal<WorkerTask[]>([]);
  protected readonly userName = computed(() => {
    const user = this.authService.user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Worker';
  });

  constructor() {
    this.loadTasks();
  }

  protected loadTasks(): void {
    const user = this.authService.user();
    if (!user) return;

    this.loading.set(true);
    this.workerService.getMyTasks(user.id).subscribe({
      next: (tasks) => { this.tasks.set(tasks); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openJob(task: WorkerTask): void {
    this.router.navigate(['/kanban'], { queryParams: { jobId: task.id } });
  }

  protected getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      Critical: 'chip--error',
      High: 'chip--warning',
      Normal: '',
      Low: 'chip--muted',
    };
    return `chip ${map[priority] ?? ''}`.trim();
  }

  protected getProgressPercent(task: WorkerTask): number {
    return task.subtaskCount > 0
      ? Math.round((task.subtasksCompleted / task.subtaskCount) * 100)
      : 0;
  }
}
