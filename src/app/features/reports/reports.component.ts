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
import { OnTimeDeliveryItem } from './models/on-time-delivery-item.model';
import { AverageLeadTimeItem } from './models/average-lead-time-item.model';
import { TeamWorkloadItem } from './models/team-workload-item.model';
import { CustomerActivityItem } from './models/customer-activity-item.model';
import { MyWorkHistoryItem } from './models/my-work-history-item.model';
import { MyTimeLogItem } from './models/my-time-log-item.model';
import { ArAgingItem } from './models/ar-aging-item.model';
import { RevenueItem } from './models/revenue-item.model';
import { SimplePnlItem } from './models/simple-pnl-item.model';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, BaseChartDirective, PageHeaderComponent, DataTableComponent, DatepickerComponent],
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
    { id: 'on-time-delivery', label: 'On-Time Delivery', icon: 'verified', needsDateRange: true },
    { id: 'average-lead-time', label: 'Avg Lead Time', icon: 'hourglass_top', needsDateRange: false },
    { id: 'team-workload', label: 'Team Workload', icon: 'groups', needsDateRange: false },
    { id: 'customer-activity', label: 'Customer Activity', icon: 'business', needsDateRange: false },
    { id: 'my-work-history', label: 'My Work History', icon: 'assignment_ind', needsDateRange: false },
    { id: 'my-time-log', label: 'My Time Log', icon: 'timer', needsDateRange: true },
    { id: 'ar-aging', label: 'AR Aging', icon: 'account_balance', needsDateRange: false },
    { id: 'revenue', label: 'Revenue', icon: 'attach_money', needsDateRange: true },
    { id: 'simple-pnl', label: 'Profit & Loss', icon: 'balance', needsDateRange: true },
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
  protected readonly onTimeDeliveryData = signal<OnTimeDeliveryItem | null>(null);
  protected readonly averageLeadTimeData = signal<AverageLeadTimeItem[]>([]);
  protected readonly teamWorkloadData = signal<TeamWorkloadItem[]>([]);
  protected readonly customerActivityData = signal<CustomerActivityItem[]>([]);
  protected readonly myWorkHistoryData = signal<MyWorkHistoryItem[]>([]);
  protected readonly myTimeLogData = signal<MyTimeLogItem[]>([]);
  protected readonly arAgingData = signal<ArAgingItem[]>([]);
  protected readonly revenueData = signal<RevenueItem[]>([]);
  protected readonly simplePnlData = signal<SimplePnlItem[]>([]);

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

  protected readonly onTimeDeliveryChart = computed<ChartData<'pie'>>(() => {
    const data = this.onTimeDeliveryData();
    if (!data) return { labels: [], datasets: [{ data: [] }] };
    return {
      labels: ['On Time', 'Late'],
      datasets: [{
        data: [data.onTime, data.late],
        backgroundColor: ['#22c55e', '#ef4444'],
      }],
    };
  });

  protected readonly averageLeadTimeChart = computed<ChartData<'bar'>>(() => {
    const data = this.averageLeadTimeData();
    return {
      labels: data.map(d => d.stageName),
      datasets: [{
        data: data.map(d => d.averageDays),
        backgroundColor: data.map(d => d.stageColor),
        label: 'Avg Days',
      }],
    };
  });

  protected readonly teamWorkloadChart = computed<ChartData<'bar'>>(() => {
    const data = this.teamWorkloadData();
    return {
      labels: data.map(d => d.userName),
      datasets: [
        { data: data.map(d => d.activeJobs), label: 'Active', backgroundColor: 'rgba(59, 130, 246, 0.7)' },
        { data: data.map(d => d.overdueJobs), label: 'Overdue', backgroundColor: 'rgba(239, 68, 68, 0.7)' },
      ],
    };
  });

  protected readonly customerActivityChart = computed<ChartData<'bar'>>(() => {
    const data = this.customerActivityData().slice(0, 10);
    return {
      labels: data.map(d => d.customerName),
      datasets: [
        { data: data.map(d => d.activeJobs), label: 'Active', backgroundColor: 'rgba(59, 130, 246, 0.7)' },
        { data: data.map(d => d.completedJobs), label: 'Completed', backgroundColor: 'rgba(34, 197, 94, 0.7)' },
      ],
    };
  });

  protected readonly revenueChart = computed<ChartData<'bar'>>(() => {
    const data = this.revenueData();
    return {
      labels: data.map(d => d.customerName ?? d.period),
      datasets: [{
        data: data.map(d => d.total),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        label: 'Revenue',
      }],
    };
  });

  protected readonly pnlTotals = computed(() => {
    const data = this.simplePnlData();
    const revenue = data.filter(d => d.type === 'Revenue').reduce((sum, d) => sum + d.amount, 0);
    const expenses = data.filter(d => d.type === 'Expense').reduce((sum, d) => sum + d.amount, 0);
    return { revenue, expenses, net: revenue - expenses };
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

  protected readonly stackedBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  protected readonly leadTimeColumns: ColumnDef[] = [
    { field: 'stageName', header: 'Stage', sortable: true },
    { field: 'averageDays', header: 'Avg Days', sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly workloadColumns: ColumnDef[] = [
    { field: 'userName', header: 'Team Member', sortable: true },
    { field: 'activeJobs', header: 'Active', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'overdueJobs', header: 'Overdue', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'hoursThisWeek', header: 'Hours (Week)', sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly customerColumns: ColumnDef[] = [
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'activeJobs', header: 'Active', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completedJobs', header: 'Completed', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalJobs', header: 'Total', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'lastJobDate', header: 'Last Job', sortable: true, type: 'date', width: '120px' },
  ];

  protected readonly trendColumns: ColumnDef[] = [
    { field: 'month', header: 'Month', sortable: true },
    { field: 'created', header: 'Created', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'completed', header: 'Completed', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly workHistoryColumns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'title', header: 'Title', sortable: true },
    { field: 'stageName', header: 'Stage', sortable: true, width: '140px' },
    { field: 'customerName', header: 'Customer', sortable: true, width: '140px' },
    { field: 'dueDate', header: 'Due Date', sortable: true, type: 'date', width: '100px' },
    { field: 'completedAt', header: 'Completed', sortable: true, type: 'date', width: '100px' },
  ];

  protected readonly timeLogColumns: ColumnDef[] = [
    { field: 'date', header: 'Date', sortable: true, type: 'date', width: '100px' },
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'jobTitle', header: 'Job', sortable: true },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'durationMinutes', header: 'Minutes', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'notes', header: 'Notes', sortable: false },
  ];

  protected readonly arAgingColumns: ColumnDef[] = [
    { field: 'invoiceNumber', header: 'Invoice #', sortable: true, width: '110px' },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'dueDate', header: 'Due Date', sortable: true, type: 'date', width: '110px' },
    { field: 'total', header: 'Total', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'amountPaid', header: 'Paid', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'balanceDue', header: 'Balance', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'daysOverdue', header: 'Days Overdue', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'agingBucket', header: 'Bucket', sortable: true, filterable: true, type: 'enum', width: '110px', filterOptions: [
      { value: 'Current', label: 'Current' },
      { value: '1-30 Days', label: '1-30 Days' },
      { value: '31-60 Days', label: '31-60 Days' },
      { value: '61-90 Days', label: '61-90 Days' },
      { value: '90+ Days', label: '90+ Days' },
    ]},
  ];

  protected readonly revenueColumns: ColumnDef[] = [
    { field: 'period', header: 'Period', sortable: true },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'invoiceCount', header: 'Invoices', sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'subtotal', header: 'Subtotal', sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'taxAmount', header: 'Tax', sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'total', header: 'Total', sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'amountPaid', header: 'Paid', sortable: true, type: 'number', width: '110px', align: 'right' },
  ];

  protected readonly pnlColumns: ColumnDef[] = [
    { field: 'category', header: 'Category', sortable: true },
    { field: 'type', header: 'Type', sortable: true, filterable: true, type: 'enum', width: '100px', filterOptions: [
      { value: 'Revenue', label: 'Revenue' },
      { value: 'Expense', label: 'Expense' },
    ]},
    { field: 'amount', header: 'Amount', sortable: true, type: 'number', width: '130px', align: 'right' },
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
      case 'on-time-delivery':
        this.reportService.getOnTimeDelivery(this.startValue(), this.endValue()).subscribe(d => { this.onTimeDeliveryData.set(d); this.loading.set(false); });
        break;
      case 'average-lead-time':
        this.reportService.getAverageLeadTime().subscribe(d => { this.averageLeadTimeData.set(d); this.loading.set(false); });
        break;
      case 'team-workload':
        this.reportService.getTeamWorkload().subscribe(d => { this.teamWorkloadData.set(d); this.loading.set(false); });
        break;
      case 'customer-activity':
        this.reportService.getCustomerActivity().subscribe(d => { this.customerActivityData.set(d); this.loading.set(false); });
        break;
      case 'my-work-history':
        this.reportService.getMyWorkHistory().subscribe(d => { this.myWorkHistoryData.set(d); this.loading.set(false); });
        break;
      case 'my-time-log':
        this.reportService.getMyTimeLog(this.startValue(), this.endValue()).subscribe(d => { this.myTimeLogData.set(d); this.loading.set(false); });
        break;
      case 'ar-aging':
        this.reportService.getArAging().subscribe(d => { this.arAgingData.set(d); this.loading.set(false); });
        break;
      case 'revenue':
        this.reportService.getRevenue(this.startValue(), this.endValue()).subscribe(d => { this.revenueData.set(d); this.loading.set(false); });
        break;
      case 'simple-pnl':
        this.reportService.getSimplePnl(this.startValue(), this.endValue()).subscribe(d => { this.simplePnlData.set(d); this.loading.set(false); });
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

  protected readonly arAgingBuckets = computed(() => {
    const data = this.arAgingData();
    const buckets = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'];
    return buckets.map(bucket => ({
      bucket,
      total: data.filter(d => d.agingBucket === bucket).reduce((sum, d) => sum + d.balanceDue, 0),
    }));
  });
}
