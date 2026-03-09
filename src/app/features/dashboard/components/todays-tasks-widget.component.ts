import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DashboardTask } from '../models/dashboard-task.model';

@Component({
  selector: 'app-todays-tasks-widget',
  standalone: true,
  imports: [AvatarComponent, StatusBadgeComponent],
  templateUrl: './todays-tasks-widget.component.html',
  styleUrl: './todays-tasks-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodaysTasksWidgetComponent {
  readonly tasks = input.required<DashboardTask[]>();
}
