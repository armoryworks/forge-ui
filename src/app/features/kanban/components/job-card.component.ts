import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe } from '@ngx-translate/core';

import { formatDate } from '../../../shared/utils/date.utils';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { KanbanJob } from '../models/kanban-job.model';
import { PRIORITY_COLORS } from '../models/priority-colors.const';

@Component({
  selector: 'app-job-card',
  standalone: true,
  imports: [AvatarComponent, MatTooltipModule, TranslatePipe],
  templateUrl: './job-card.component.html',
  styleUrl: './job-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobCardComponent {
  readonly job = input.required<KanbanJob>();
  readonly selected = input(false);
  readonly cardClicked = output<{ job: KanbanJob; event: Event }>();
  readonly jobNumberClicked = output<{ job: KanbanJob; event: Event }>();

  protected readonly priorityColor = computed(
    () => PRIORITY_COLORS[this.job().priorityName] ?? PRIORITY_COLORS['Normal'],
  );

  protected readonly formattedDueDate = computed(() => {
    const d = this.job().dueDate;
    if (!d) return null;
    const date = new Date(d);
    return formatDate(date);
  });

  protected readonly holdTooltip = computed(() => this.job().activeHolds.join('\n'));
}
