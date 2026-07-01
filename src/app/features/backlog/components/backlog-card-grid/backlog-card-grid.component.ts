import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { PriorityIndicatorComponent } from '../../../../shared/components/priority-indicator/priority-indicator.component';
import { KanbanJob } from '../../../kanban/models/kanban-job.model';

@Component({
  selector: 'app-backlog-card-grid',
  standalone: true,
  imports: [AvatarComponent, PriorityIndicatorComponent],
  templateUrl: './backlog-card-grid.component.html',
  styleUrl: './backlog-card-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BacklogCardGridComponent {
  readonly jobs = input.required<KanbanJob[]>();
  readonly selectedJobId = input<number | null>(null);

  readonly jobClick = output<KanbanJob>();

  protected formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
}
