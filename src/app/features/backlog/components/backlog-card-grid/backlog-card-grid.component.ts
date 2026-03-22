import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { KanbanJob } from '../../../kanban/models/kanban-job.model';

@Component({
  selector: 'app-backlog-card-grid',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './backlog-card-grid.component.html',
  styleUrl: './backlog-card-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogCardGridComponent {
  readonly jobs = input.required<KanbanJob[]>();
  readonly selectedJobId = input<number | null>(null);

  readonly jobClick = output<KanbanJob>();

  protected formatDate(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }

  protected priorityDotColor(priority: string): string {
    const map: Record<string, string> = {
      Critical: '#dc2626',
      High: '#f97316',
      Medium: '#d97706',
      Low: '#22c55e',
    };
    return map[priority] ?? '#94a3b8';
  }

}
