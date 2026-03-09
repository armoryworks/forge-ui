import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { KanbanJob } from '../models/kanban-job.model';
import { PRIORITY_COLORS } from '../models/priority-colors.const';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './job-card.component.html',
  styleUrl: './job-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCardComponent {
  readonly job = input.required<KanbanJob>();
  readonly selected = input(false);
  readonly cardClicked = output<{ job: KanbanJob; event: MouseEvent }>();

  protected readonly priorityColor = computed(
    () => PRIORITY_COLORS[this.job().priorityName] ?? PRIORITY_COLORS['Normal'],
  );

  protected readonly formattedDueDate = computed(() => {
    const d = this.job().dueDate;
    if (!d) return null;
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
}
