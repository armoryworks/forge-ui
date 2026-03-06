import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { DashboardWidgetComponent } from '../../shared/components/dashboard-widget/dashboard-widget.component';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { ActivityWidgetComponent } from './components/activity-widget.component';
import { DeadlinesWidgetComponent } from './components/deadlines-widget.component';
import { JobsByStageWidgetComponent } from './components/jobs-by-stage-widget.component';
import { TeamLoadWidgetComponent } from './components/team-load-widget.component';
import { TodaysTasksWidgetComponent } from './components/todays-tasks-widget.component';
import { MOCK_TASKS } from './services/dashboard-mock.data';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    DashboardWidgetComponent,
    KpiChipComponent,
    TodaysTasksWidgetComponent,
    JobsByStageWidgetComponent,
    TeamLoadWidgetComponent,
    ActivityWidgetComponent,
    DeadlinesWidgetComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  protected readonly taskCount = signal(MOCK_TASKS.length);
}
