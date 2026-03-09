import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { DashboardWidgetComponent } from '../../shared/components/dashboard-widget/dashboard-widget.component';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { ActivityWidgetComponent } from './components/activity-widget.component';
import { DeadlinesWidgetComponent } from './components/deadlines-widget.component';
import { JobsByStageWidgetComponent } from './components/jobs-by-stage-widget.component';
import { TeamLoadWidgetComponent } from './components/team-load-widget.component';
import { TodaysTasksWidgetComponent } from './components/todays-tasks-widget.component';
import { DashboardData } from './models/dashboard.model';
import { DashboardService } from './services/dashboard.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

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
    PageHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.dashboardService.getDashboard().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load dashboard data');
        this.loading.set(false);
      },
    });
  }
}
