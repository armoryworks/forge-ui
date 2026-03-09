import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { KanbanService } from '../services/kanban.service';
import { JobDetail, Subtask, Activity, PRIORITY_COLORS } from '../models/kanban.model';

@Component({
  selector: 'app-job-detail-panel',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent],
  templateUrl: './job-detail-panel.component.html',
  styleUrl: './job-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobDetailPanelComponent implements OnInit {
  private readonly kanbanService = inject(KanbanService);

  readonly jobId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<JobDetail>();

  protected readonly job = signal<JobDetail | null>(null);
  protected readonly subtasks = signal<Subtask[]>([]);
  protected readonly activity = signal<Activity[]>([]);
  protected readonly loading = signal(true);
  protected readonly newSubtaskControl = new FormControl('');

  ngOnInit(): void {
    const id = this.jobId();
    this.kanbanService.getJobDetail(id).subscribe(detail => {
      this.job.set(detail);
      this.loading.set(false);
    });
    this.kanbanService.getSubtasks(id).subscribe(s => this.subtasks.set(s));
    this.kanbanService.getJobActivity(id).subscribe(a => this.activity.set(a));
  }

  protected priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS['Normal'];
  }

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  protected formatActivityDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  protected completedCount(): number {
    return this.subtasks().filter(s => s.isCompleted).length;
  }

  protected toggleSubtask(subtask: Subtask): void {
    const newState = !subtask.isCompleted;
    subtask.isCompleted = newState;
    subtask.completedAt = newState ? new Date().toISOString() : null;
    this.subtasks.update(list => [...list]);
    this.kanbanService.toggleSubtask(this.jobId(), subtask.id, newState).subscribe();
  }

  protected addSubtask(): void {
    const text = (this.newSubtaskControl.value ?? '').trim();
    if (!text) return;
    this.kanbanService.addSubtask(this.jobId(), text).subscribe(st => {
      this.subtasks.update(list => [...list, st]);
      this.newSubtaskControl.reset();
    });
  }

  protected close(): void {
    this.closed.emit();
  }
}
