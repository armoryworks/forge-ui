import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { toIsoDate } from '../../shared/utils/date.utils';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ReportService } from './services/report.service';
import { ReportType } from './models/report-type.type';
import { ReportDef } from './models/report-def.model';
import { JobsByStageItem } from './models/jobs-by-stage-item.model';
import { OverdueJobItem } from './models/overdue-job-item.model';
import { TimeByUserItem } from './models/time-by-user-item.model';
import { ExpenseSummaryItem } from './models/expense-summary-item.model';
import { LeadPipelineItem } from './models/lead-pipeline-item.model';
import { JobCompletionTrendItem } from './models/job-completion-trend-item.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ReactiveFormsModule, BaseChartDirective, PageHeaderComponent, DataTableComponent, DatepickerComponent],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);

  protected readonly reports: ReportDef[] = [
    { id: 'jobs-by-stage', label: 'Jobs by Stage', icon: 'view_kanban', needsDateRange: false },
    { id: 'overdue-jobs', label: 'Overdue Jobs', icon: 'warning', needsDateRange: false },
    { id: 'time-by-user', label: 'Time by User', icon: 'schedule', needsDateRange: true },
    { id: 'expense-summary', label: 'Expense Summary', icon: 'receipt_long', needsDateRange: true },
    { id: 'lead-pipeline', label: 'Lead Pipeline', icon: 'filter_alt', needsDateRange: false },
    { id: 'job-completion-trend', label: 'Completion Trend', icon: 'trending_up', needsDateRange: false },
  ];

  protected readonly activeReport = signal<ReportType>('jobs-by-stage');
  protected readonly loading = signal(false);
  protected readonly activeReportDef = computed(() => this.reports.find(r => r.id === this.activeReport())!);

  // Date range controls (DatepickerComponent works with Date objects)
  protected readonly startControl = new FormControl<Date | null>(this.defaultStart());
  protected readonly endControl = new FormControl<Date | null>(this.defaultEnd());

  // Report data
  protected readonly jobsByStageData = signal<JobsByStageItem[]>([]);
  protected readonly overdueJobsData = signal<OverdueJobItem[]>([]);
  protected readonly timeByUserData = signal<TimeByUserItem[]>([]);
  protected readonly expenseSummaryData = signal<ExpenseSummaryItem[]>([]);
  protected readonly leadPipelineData = signal<LeadPipelineItem[]>([]);
  protected readonly completionTrendData = signal<JobCompletionTrendItem[]>([]);

  // Chart configurations
  protected readonly jobsByStageChart = computed<ChartData<'bar'>>(() => {
    const data = this.jobsByStageData();
    return {
      labels: data.map(d => d.stageName),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: data.map(d => d.stageColor),
        label: 'Jobs',
      }],
    };
  });

  protected readonly timeByUserChart = computed<ChartData<'bar'>>(() => {
    const data = this.timeByUserData();
    return {
      labels: data.map(d => d.userName),
      datasets: [{
        data: data.map(d => d.totalHours),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        label: 'Hours',
      }],
    };
  });

  protected readonly expenseSummaryChart = computed<ChartData<'pie'>>(() => {
    const data = this.expenseSummaryData();
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];
    return {
      labels: data.map(d => d.category),
      datasets: [{
        data: data.map(d => d.totalAmount),
        backgroundColor: data.map((_, i) => colors[i % colors.length]),
      }],
    };
  });

  protected readonly leadPipelineChart = computed<ChartData<'bar'>>(() => {
    const data = this.leadPipelineData();
    const statusColors: Record<string, string> = {
      New: '#3b82f6', Qualified: '#8b5cf6', Proposal: '#f59e0b', Won: '#22c55e', Lost: '#ef4444',
    };
    return {
      labels: data.map(d => d.status),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: data.map(d => statusColors[d.status] ?? '#94a3b8'),
        label: 'Leads',
      }],
    };
  });

  protected readonly completionTrendChart = computed<ChartData<'line'>>(() => {
    const data = this.completionTrendData();
    return {
      labels: data.map(d => d.month),
      datasets: [
        { data: data.map(d => d.created), label: 'Created', borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 },
        { data: data.map(d => d.completed), label: 'Completed', borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.3 },
      ],
    };
  });

  protected readonly barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  protected readonly pieOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } },
  };

  protected readonly lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  // Table columns
  protected readonly stageColumns: ColumnDef[] = [
    { field: 'stageName', header: 'Stage', sortable: true },
    { field: 'count', header: 'Count', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly overdueColumns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'title', header: 'Title', sortable: true },
    { field: 'dueDate', header: 'Due Date', sortable: true, type: 'date', width: '120px' },
    { field: 'daysOverdue', header: 'Days Overdue', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'assigneeName', header: 'Assignee', sortable: true, width: '140px' },
  ];

  protected readonly timeColumns: ColumnDef[] = [
    { field: 'userName', header: 'User', sortable: true },
    { field: 'totalHours', header: 'Hours', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly expenseColumns: ColumnDef[] = [
    { field: 'category', header: 'Category', sortable: true },
    { field: 'totalAmount', header: 'Total Amount', sortable: true, type: 'number', width: '140px', align: 'right' },
    { field: 'count', header: 'Count', sortable: true, type: 'number', width: '80px', align: 'right' },
  ];

  protected readonly leadColumns: ColumnDef[] = [
    { field: 'status', header: 'Status', sortable: true },
    { field: 'count', header: 'Count', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly trendColumns: ColumnDef[] = [
    { field: 'month', header: 'Month', sortable: true },
    { field: 'created', header: 'Created', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'completed', header: 'Completed', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  constructor() {
    this.loadReport('jobs-by-stage');
  }

  protected selectReport(reportId: ReportType): void {
    this.activeReport.set(reportId);
    this.loadReport(reportId);
  }

  protected loadReport(reportId?: ReportType): void {
    const id = reportId ?? this.activeReport();
    this.loading.set(true);

    switch (id) {
      case 'jobs-by-stage':
        this.reportService.getJobsByStage().subscribe(d => { this.jobsByStageData.set(d); this.loading.set(false); });
        break;
      case 'overdue-jobs':
        this.reportService.getOverdueJobs().subscribe(d => { this.overdueJobsData.set(d); this.loading.set(false); });
        break;
      case 'time-by-user':
        this.reportService.getTimeByUser(this.startValue(), this.endValue()).subscribe(d => { this.timeByUserData.set(d); this.loading.set(false); });
        break;
      case 'expense-summary':
        this.reportService.getExpenseSummary(this.startValue(), this.endValue()).subscribe(d => { this.expenseSummaryData.set(d); this.loading.set(false); });
        break;
      case 'lead-pipeline':
        this.reportService.getLeadPipeline().subscribe(d => { this.leadPipelineData.set(d); this.loading.set(false); });
        break;
      case 'job-completion-trend':
        this.reportService.getJobCompletionTrend().subscribe(d => { this.completionTrendData.set(d); this.loading.set(false); });
        break;
    }
  }

  private startValue(): string {
    const d = this.startControl.value ?? this.defaultStart();
    return toIsoDate(d)!;
  }

  private endValue(): string {
    const d = this.endControl.value ?? this.defaultEnd();
    return toIsoDate(d)!;
  }

  private defaultStart(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  }

  private defaultEnd(): Date {
    return new Date();
  }
}
