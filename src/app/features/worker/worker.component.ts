import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkerService } from './services/worker.service';
import { WorkerTask } from './models/worker-task.model';
import { AuthService } from '../../shared/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-worker',
  standalone: true,
  imports: [DatePipe, MatTooltipModule, AvatarComponent, EmptyStateComponent, LoadingBlockDirective, TranslatePipe],
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
    return user ? `${user.lastName}, ${user.firstName}`.trim() : 'Worker';
  });

  protected readonly sortedTasks = computed(() => {
    const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };
    return [...this.tasks()].sort((a, b) => {
      const aOverdue = this.isOverdue(a) ? 0 : 1;
      const bOverdue = this.isOverdue(b) ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const aDate = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bDate = b.dueDate ? b.dueDate.getTime() : Infinity;
      if (aDate !== bDate) return aDate - bDate;
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
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

  protected isOverdue(task: WorkerTask): boolean {
    if (!task.dueDate) return false;
    return task.dueDate.getTime() < new Date().getTime();
  }

  protected getProgressPercent(task: WorkerTask): number {
    return task.subtaskCount > 0
      ? Math.round((task.subtasksCompleted / task.subtaskCount) * 100)
      : 0;
  }
}
