import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { DashboardTask } from '../models/dashboard.model';
import { MOCK_TASKS } from '../services/dashboard-mock.data';

@Component({
  selector: 'app-todays-tasks-widget',
  standalone: true,
  imports: [AvatarComponent, StatusBadgeComponent],
  templateUrl: './todays-tasks-widget.component.html',
  styleUrl: './todays-tasks-widget.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodaysTasksWidgetComponent {
  protected readonly tasks = signal<DashboardTask[]>(MOCK_TASKS);
}
