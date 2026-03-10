import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { DashboardWidgetComponent } from '../../shared/components/dashboard-widget/dashboard-widget.component';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { ActivityWidgetComponent } from './components/activity-widget.component';
import { DeadlinesWidgetComponent } from './components/deadlines-widget.component';
import { JobsByStageWidgetComponent } from './components/jobs-by-stage-widget.component';
import { TeamLoadWidgetComponent } from './components/team-load-widget.component';
import { TodaysTasksWidgetComponent } from './components/todays-tasks-widget.component';
import { CycleProgressWidgetComponent } from './components/cycle-progress-widget.component';
import { DashboardData } from './models/dashboard-data.model';
import { DashboardService } from './services/dashboard.service';
import { LoadingService } from '../../shared/services/loading.service';
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
    CycleProgressWidgetComponent,
    PageHeaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);
  private readonly loadingService = inject(LoadingService);

  protected readonly data = signal<DashboardData | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadingService.track('Loading dashboard...', this.dashboardService.getDashboard())
      .subscribe({
        next: (data) => this.data.set(data),
        error: () => this.error.set('Failed to load dashboard data'),
      });
  }

  protected exportDashboard(): void {
    const d = this.data();
    if (!d) return;

    const lines: string[] = [];
    lines.push('Section,Field,Value');
    lines.push(`KPIs,Active Jobs,${d.kpis.activeCount}`);
    lines.push(`KPIs,Overdue Jobs,${d.kpis.overdueCount}`);
    lines.push(`KPIs,Total Hours,${d.kpis.totalHours}`);
    lines.push('');
    lines.push('Stage,Count');
    for (const s of d.stages) {
      lines.push(`${s.label},${s.count}`);
    }
    lines.push('');
    lines.push('Team Member,Task Count');
    for (const t of d.team) {
      lines.push(`${t.name},${t.taskCount}`);
    }
    lines.push('');
    lines.push('Deadline,Job #,Title,Overdue');
    for (const dl of d.deadlines) {
      lines.push(`${dl.date},${dl.jobNumber},"${dl.description}",${dl.isOverdue}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
