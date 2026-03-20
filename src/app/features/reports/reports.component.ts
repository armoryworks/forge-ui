import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { MyExpenseHistoryItem } from './models/my-expense-history-item.model';
import { QuoteToCloseItem } from './models/quote-to-close-item.model';
import { ShippingSummaryItem } from './models/shipping-summary-item.model';
import { TimeInStageItem } from './models/time-in-stage-item.model';
import { EmployeeProductivityItem } from './models/employee-productivity-item.model';
import { InventoryLevelItem } from './models/inventory-level-item.model';
import { MaintenanceReportItem } from './models/maintenance-report-item.model';
import { QualityScrapItem } from './models/quality-scrap-item.model';
import { CycleReviewItem } from './models/cycle-review-item.model';
import { JobMarginItem } from './models/job-margin-item.model';
import { MyCycleSummaryItem } from './models/my-cycle-summary-item.model';
import { LeadSalesItem } from './models/lead-sales-item.model';
import { RdReportItem } from './models/rd-report-item.model';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe, BaseChartDirective, PageHeaderComponent, DataTableComponent, DatepickerComponent, TranslatePipe],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsComponent {
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly reports: ReportDef[] = [
    { id: 'jobs-by-stage', label: this.translate.instant('reports.navJobsByStage'), icon: 'view_kanban', needsDateRange: false },
    { id: 'overdue-jobs', label: this.translate.instant('reports.navOverdueJobs'), icon: 'warning', needsDateRange: false },
    { id: 'time-by-user', label: this.translate.instant('reports.navTimeByUser'), icon: 'schedule', needsDateRange: true },
    { id: 'expense-summary', label: this.translate.instant('reports.navExpenseSummary'), icon: 'receipt_long', needsDateRange: true },
    { id: 'lead-pipeline', label: this.translate.instant('reports.navLeadPipeline'), icon: 'filter_alt', needsDateRange: false },
    { id: 'job-completion-trend', label: this.translate.instant('reports.navCompletionTrend'), icon: 'trending_up', needsDateRange: false },
    { id: 'on-time-delivery', label: this.translate.instant('reports.navOnTimeDelivery'), icon: 'verified', needsDateRange: true },
    { id: 'average-lead-time', label: this.translate.instant('reports.navAvgLeadTime'), icon: 'hourglass_top', needsDateRange: false },
    { id: 'team-workload', label: this.translate.instant('reports.navTeamWorkload'), icon: 'groups', needsDateRange: false },
    { id: 'customer-activity', label: this.translate.instant('reports.navCustomerActivity'), icon: 'business', needsDateRange: false },
    { id: 'my-work-history', label: this.translate.instant('reports.navMyWorkHistory'), icon: 'assignment_ind', needsDateRange: false },
    { id: 'my-time-log', label: this.translate.instant('reports.navMyTimeLog'), icon: 'timer', needsDateRange: true },
    { id: 'ar-aging', label: this.translate.instant('reports.navArAging'), icon: 'account_balance', needsDateRange: false },
    { id: 'revenue', label: this.translate.instant('reports.navRevenue'), icon: 'attach_money', needsDateRange: true },
    { id: 'simple-pnl', label: this.translate.instant('reports.navProfitLoss'), icon: 'balance', needsDateRange: true },
    { id: 'my-expense-history', label: this.translate.instant('reports.navMyExpenses'), icon: 'receipt', needsDateRange: true },
    { id: 'quote-to-close', label: this.translate.instant('reports.navQuoteToClose'), icon: 'handshake', needsDateRange: true },
    { id: 'shipping-summary', label: this.translate.instant('reports.navShippingSummary'), icon: 'local_shipping', needsDateRange: true },
    { id: 'time-in-stage', label: this.translate.instant('reports.navTimeInStage'), icon: 'hourglass_bottom', needsDateRange: false },
    { id: 'employee-productivity', label: this.translate.instant('reports.navEmployeeProductivity'), icon: 'person_search', needsDateRange: true },
    { id: 'inventory-levels', label: this.translate.instant('reports.navInventoryLevels'), icon: 'inventory_2', needsDateRange: false },
    { id: 'maintenance', label: this.translate.instant('reports.navMaintenance'), icon: 'build', needsDateRange: true },
    { id: 'quality-scrap', label: this.translate.instant('reports.navQualityScrap'), icon: 'verified', needsDateRange: true },
    { id: 'cycle-review', label: this.translate.instant('reports.navCycleReview'), icon: 'event_repeat', needsDateRange: false },
    { id: 'job-margin', label: this.translate.instant('reports.navJobMargin'), icon: 'trending_up', needsDateRange: true },
    { id: 'my-cycle-summary', label: this.translate.instant('reports.navMyCycleSummary'), icon: 'event_repeat', needsDateRange: false },
    { id: 'lead-sales', label: this.translate.instant('reports.navLeadSales'), icon: 'leaderboard', needsDateRange: true },
    { id: 'rd', label: this.translate.instant('reports.navRdReport'), icon: 'science', needsDateRange: true },
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
  protected readonly myExpenseHistoryData = signal<MyExpenseHistoryItem[]>([]);
  protected readonly quoteToCloseData = signal<QuoteToCloseItem[]>([]);
  protected readonly shippingSummaryData = signal<ShippingSummaryItem[]>([]);
  protected readonly timeInStageData = signal<TimeInStageItem[]>([]);
  protected readonly employeeProductivityData = signal<EmployeeProductivityItem[]>([]);
  protected readonly inventoryLevelsData = signal<InventoryLevelItem[]>([]);
  protected readonly maintenanceData = signal<MaintenanceReportItem[]>([]);
  protected readonly qualityScrapData = signal<QualityScrapItem[]>([]);
  protected readonly cycleReviewData = signal<CycleReviewItem[]>([]);
  protected readonly jobMarginData = signal<JobMarginItem[]>([]);
  protected readonly myCycleSummaryData = signal<MyCycleSummaryItem[]>([]);
  protected readonly leadSalesData = signal<LeadSalesItem | null>(null);
  protected readonly rdReportData = signal<RdReportItem[]>([]);

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

  protected readonly quoteToCloseChart = computed<ChartData<'bar'>>(() => {
    const data = this.quoteToCloseData();
    const statusColors: Record<string, string> = {
      Draft: '#94a3b8', Sent: '#3b82f6', Accepted: '#22c55e', Rejected: '#ef4444', Expired: '#f59e0b',
    };
    return {
      labels: data.map(d => d.status),
      datasets: [{
        data: data.map(d => d.count),
        backgroundColor: data.map(d => statusColors[d.status] ?? '#94a3b8'),
        label: 'Quotes',
      }],
    };
  });

  protected readonly timeInStageChart = computed<ChartData<'bar'>>(() => {
    const data = this.timeInStageData();
    return {
      labels: data.map(d => d.stageName),
      datasets: [{
        data: data.map(d => d.averageDays),
        backgroundColor: data.map(d => d.stageColor),
        label: 'Avg Days',
      }],
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

  protected readonly employeeProductivityChart = computed<ChartData<'bar'>>(() => {
    const data = this.employeeProductivityData();
    return {
      labels: data.map(d => d.userName),
      datasets: [{
        data: data.map(d => d.totalHours),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        label: 'Hours',
      }],
    };
  });

  protected readonly inventoryLevelsChart = computed<ChartData<'bar'>>(() => {
    const data = this.inventoryLevelsData();
    return {
      labels: data.map(d => d.partNumber),
      datasets: [{
        data: data.map(d => d.currentStock),
        backgroundColor: data.map(d => d.isLowStock ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)'),
        label: 'Stock',
      }],
    };
  });

  protected readonly maintenanceChart = computed<ChartData<'bar'>>(() => {
    const data = this.maintenanceData();
    return {
      labels: data.map(d => d.assetName),
      datasets: [{
        data: data.map(d => d.completedCount),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        label: 'Completed',
      }],
    };
  });

  protected readonly qualityScrapChart = computed<ChartData<'bar'>>(() => {
    const data = this.qualityScrapData();
    return {
      labels: data.map(d => d.partNumber),
      datasets: [{
        data: data.map(d => d.scrapRate),
        backgroundColor: data.map(d => d.scrapRate > 10 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)'),
        label: 'Scrap Rate %',
      }],
    };
  });

  protected readonly cycleReviewChart = computed<ChartData<'bar'>>(() => {
    const data = this.cycleReviewData();
    return {
      labels: data.map(d => d.cycleName),
      datasets: [{
        data: data.map(d => d.completionRate),
        backgroundColor: data.map(d => d.completionRate >= 80 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(245, 158, 11, 0.7)'),
        label: 'Completion %',
      }],
    };
  });

  protected readonly jobMarginChart = computed<ChartData<'bar'>>(() => {
    const data = this.jobMarginData();
    return {
      labels: data.map(d => d.jobNumber),
      datasets: [{
        data: data.map(d => d.margin),
        backgroundColor: data.map(d => d.margin >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
        label: 'Margin',
      }],
    };
  });

  protected readonly jobMarginTotals = computed(() => {
    const data = this.jobMarginData();
    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);
    const totalMargin = totalRevenue - totalCost;
    const avgMarginPct = data.length > 0
      ? data.reduce((sum, d) => sum + d.marginPercentage, 0) / data.length
      : 0;
    return { totalRevenue, totalCost, totalMargin, avgMarginPct: Math.round(avgMarginPct * 10) / 10 };
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
    { field: 'stageName', header: this.translate.instant('reports.colStage'), sortable: true },
    { field: 'count', header: this.translate.instant('reports.colCount'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly overdueColumns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('reports.colJobNumber'), sortable: true, width: '100px' },
    { field: 'title', header: this.translate.instant('reports.colTitle'), sortable: true },
    { field: 'dueDate', header: this.translate.instant('reports.colDueDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'daysOverdue', header: this.translate.instant('reports.colDaysOverdue'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'assigneeName', header: this.translate.instant('reports.colAssignee'), sortable: true, width: '140px' },
  ];

  protected readonly timeColumns: ColumnDef[] = [
    { field: 'userName', header: this.translate.instant('reports.colUser'), sortable: true },
    { field: 'totalHours', header: this.translate.instant('reports.colHours'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly expenseColumns: ColumnDef[] = [
    { field: 'category', header: this.translate.instant('reports.colCategory'), sortable: true },
    { field: 'totalAmount', header: this.translate.instant('reports.colTotalAmount'), sortable: true, type: 'number', width: '140px', align: 'right' },
    { field: 'count', header: this.translate.instant('reports.colCount'), sortable: true, type: 'number', width: '80px', align: 'right' },
  ];

  protected readonly leadColumns: ColumnDef[] = [
    { field: 'status', header: this.translate.instant('reports.colStatus'), sortable: true },
    { field: 'count', header: this.translate.instant('reports.colCount'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly stackedBarOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } },
  };

  protected readonly leadTimeColumns: ColumnDef[] = [
    { field: 'stageName', header: this.translate.instant('reports.colStage'), sortable: true },
    { field: 'averageDays', header: this.translate.instant('reports.colAvgDays'), sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly workloadColumns: ColumnDef[] = [
    { field: 'userName', header: this.translate.instant('reports.colTeamMember'), sortable: true },
    { field: 'activeJobs', header: this.translate.instant('reports.colActive'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'overdueJobs', header: this.translate.instant('reports.colOverdue'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'hoursThisWeek', header: this.translate.instant('reports.colHoursWeek'), sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly customerColumns: ColumnDef[] = [
    { field: 'customerName', header: this.translate.instant('reports.colCustomer'), sortable: true },
    { field: 'activeJobs', header: this.translate.instant('reports.colActive'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completedJobs', header: this.translate.instant('reports.colCompleted'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalJobs', header: this.translate.instant('reports.colTotal'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'lastJobDate', header: this.translate.instant('reports.colLastJob'), sortable: true, type: 'date', width: '120px' },
  ];

  protected readonly trendColumns: ColumnDef[] = [
    { field: 'month', header: this.translate.instant('reports.colMonth'), sortable: true },
    { field: 'created', header: this.translate.instant('reports.colCreated'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'completed', header: this.translate.instant('reports.colCompleted'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly workHistoryColumns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('reports.colJobNumber'), sortable: true, width: '100px' },
    { field: 'title', header: this.translate.instant('reports.colTitle'), sortable: true },
    { field: 'stageName', header: this.translate.instant('reports.colStage'), sortable: true, width: '140px' },
    { field: 'customerName', header: this.translate.instant('reports.colCustomer'), sortable: true, width: '140px' },
    { field: 'dueDate', header: this.translate.instant('reports.colDueDate'), sortable: true, type: 'date', width: '100px' },
    { field: 'completedAt', header: this.translate.instant('reports.colCompleted'), sortable: true, type: 'date', width: '100px' },
  ];

  protected readonly timeLogColumns: ColumnDef[] = [
    { field: 'date', header: this.translate.instant('reports.colDate'), sortable: true, type: 'date', width: '100px' },
    { field: 'jobNumber', header: this.translate.instant('reports.colJobNumber'), sortable: true, width: '100px' },
    { field: 'jobTitle', header: this.translate.instant('reports.colJob'), sortable: true },
    { field: 'category', header: this.translate.instant('reports.colCategory'), sortable: true, width: '120px' },
    { field: 'durationMinutes', header: this.translate.instant('reports.colMinutes'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'notes', header: this.translate.instant('reports.colNotes'), sortable: false },
  ];

  protected readonly arAgingColumns: ColumnDef[] = [
    { field: 'invoiceNumber', header: this.translate.instant('reports.colInvoiceNumber'), sortable: true, width: '110px' },
    { field: 'customerName', header: this.translate.instant('reports.colCustomer'), sortable: true },
    { field: 'dueDate', header: this.translate.instant('reports.colDueDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'total', header: this.translate.instant('reports.colTotal'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'amountPaid', header: this.translate.instant('reports.colPaid'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'balanceDue', header: this.translate.instant('reports.colBalance'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'daysOverdue', header: this.translate.instant('reports.colDaysOverdue'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'agingBucket', header: this.translate.instant('reports.colBucket'), sortable: true, filterable: true, type: 'enum', width: '110px', filterOptions: [
      { value: 'Current', label: this.translate.instant('reports.bucketCurrent') },
      { value: '1-30 Days', label: this.translate.instant('reports.bucket1to30') },
      { value: '31-60 Days', label: this.translate.instant('reports.bucket31to60') },
      { value: '61-90 Days', label: this.translate.instant('reports.bucket61to90') },
      { value: '90+ Days', label: this.translate.instant('reports.bucket90plus') },
    ]},
  ];

  protected readonly revenueColumns: ColumnDef[] = [
    { field: 'period', header: this.translate.instant('reports.colPeriod'), sortable: true },
    { field: 'customerName', header: this.translate.instant('reports.colCustomer'), sortable: true },
    { field: 'invoiceCount', header: this.translate.instant('reports.colInvoices'), sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'subtotal', header: this.translate.instant('reports.colSubtotal'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'taxAmount', header: this.translate.instant('reports.colTax'), sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'total', header: this.translate.instant('reports.colTotal'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'amountPaid', header: this.translate.instant('reports.colPaid'), sortable: true, type: 'number', width: '110px', align: 'right' },
  ];

  protected readonly pnlColumns: ColumnDef[] = [
    { field: 'category', header: this.translate.instant('reports.colCategory'), sortable: true },
    { field: 'type', header: this.translate.instant('reports.colType'), sortable: true, filterable: true, type: 'enum', width: '100px', filterOptions: [
      { value: 'Revenue', label: this.translate.instant('reports.filterRevenue') },
      { value: 'Expense', label: this.translate.instant('reports.filterExpense') },
    ]},
    { field: 'amount', header: this.translate.instant('reports.colAmount'), sortable: true, type: 'number', width: '130px', align: 'right' },
  ];

  protected readonly myExpenseColumns: ColumnDef[] = [
    { field: 'expenseDate', header: this.translate.instant('reports.colDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'category', header: this.translate.instant('reports.colCategory'), sortable: true, width: '140px' },
    { field: 'description', header: this.translate.instant('reports.colDescription'), sortable: true },
    { field: 'amount', header: this.translate.instant('reports.colAmount'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'status', header: this.translate.instant('reports.colStatus'), sortable: true, width: '100px' },
    { field: 'vendor', header: this.translate.instant('reports.colVendor'), sortable: true, width: '140px' },
  ];

  protected readonly quoteToCloseColumns: ColumnDef[] = [
    { field: 'status', header: this.translate.instant('reports.colStatus'), sortable: true },
    { field: 'count', header: this.translate.instant('reports.colCount'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalValue', header: this.translate.instant('reports.colTotalValue'), sortable: true, type: 'number', width: '130px', align: 'right' },
  ];

  protected readonly shippingSummaryColumns: ColumnDef[] = [
    { field: 'status', header: this.translate.instant('reports.colStatus'), sortable: true },
    { field: 'count', header: this.translate.instant('reports.colShipments'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalItems', header: this.translate.instant('reports.colTotalItems'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'onTimeCount', header: this.translate.instant('reports.colOnTime'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'lateCount', header: this.translate.instant('reports.colLate'), sortable: true, type: 'number', width: '80px', align: 'right' },
  ];

  protected readonly timeInStageColumns: ColumnDef[] = [
    { field: 'stageName', header: this.translate.instant('reports.colStage'), sortable: true },
    { field: 'averageDays', header: this.translate.instant('reports.colAvgDays'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'jobCount', header: this.translate.instant('reports.colJobs'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'isBottleneck', header: this.translate.instant('reports.colBottleneck'), sortable: false, width: '100px' },
  ];

  protected readonly employeeProductivityColumns: ColumnDef[] = [
    { field: 'userName', header: this.translate.instant('reports.colEmployee'), sortable: true },
    { field: 'totalHours', header: this.translate.instant('reports.colTotalHours'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'jobsCompleted', header: this.translate.instant('reports.colJobsDone'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'avgHoursPerJob', header: this.translate.instant('reports.colAvgHrsJob'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'onTimePercentage', header: this.translate.instant('reports.colOnTimePercent'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly inventoryLevelsColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('reports.colPartNumber'), sortable: true, width: '120px' },
    { field: 'description', header: this.translate.instant('reports.colDescription'), sortable: true },
    { field: 'currentStock', header: this.translate.instant('reports.colStock'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'minStockThreshold', header: this.translate.instant('reports.colMinThreshold'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'reorderPoint', header: this.translate.instant('reports.colReorderPt'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'isLowStock', header: this.translate.instant('reports.colLowStock'), sortable: true, width: '100px' },
  ];

  protected readonly maintenanceColumns: ColumnDef[] = [
    { field: 'assetName', header: this.translate.instant('reports.colAsset'), sortable: true },
    { field: 'scheduledCount', header: this.translate.instant('reports.colScheduled'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'completedCount', header: this.translate.instant('reports.colCompleted'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'overdueCount', header: this.translate.instant('reports.colOverdue'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalCost', header: this.translate.instant('reports.colTotalCost'), sortable: true, type: 'number', width: '120px', align: 'right' },
  ];

  protected readonly qualityScrapColumns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('reports.colPartNumber'), sortable: true, width: '120px' },
    { field: 'totalProduced', header: this.translate.instant('reports.colProduced'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalScrapped', header: this.translate.instant('reports.colScrapped'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'scrapRate', header: this.translate.instant('reports.colScrapPercent'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'yieldRate', header: this.translate.instant('reports.colYieldPercent'), sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  protected readonly cycleReviewColumns: ColumnDef[] = [
    { field: 'cycleName', header: this.translate.instant('reports.colCycle'), sortable: true },
    { field: 'startDate', header: this.translate.instant('reports.colStart'), sortable: true, type: 'date', width: '110px' },
    { field: 'endDate', header: this.translate.instant('reports.colEnd'), sortable: true, type: 'date', width: '110px' },
    { field: 'totalEntries', header: this.translate.instant('reports.colTotal'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completedEntries', header: this.translate.instant('reports.colDone'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completionRate', header: this.translate.instant('reports.colRatePercent'), sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'rolledOverCount', header: this.translate.instant('reports.colRolledOver'), sortable: true, type: 'number', width: '110px', align: 'right' },
  ];

  protected readonly jobMarginColumns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('reports.colJobNumber'), sortable: true, width: '100px' },
    { field: 'title', header: this.translate.instant('reports.colTitle'), sortable: true },
    { field: 'customerName', header: this.translate.instant('reports.colCustomer'), sortable: true, width: '140px' },
    { field: 'revenue', header: this.translate.instant('reports.colRevenue'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'laborCost', header: this.translate.instant('reports.colLabor'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'materialCost', header: this.translate.instant('reports.colMaterial'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'expenseCost', header: this.translate.instant('reports.colExpenses'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalCost', header: this.translate.instant('reports.colTotalCost'), sortable: true, type: 'number', width: '110px', align: 'right' },
    { field: 'margin', header: this.translate.instant('reports.colMargin'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'marginPercentage', header: this.translate.instant('reports.colMarginPercent'), sortable: true, type: 'number', width: '90px', align: 'right' },
  ];

  protected readonly myCycleSummaryColumns: ColumnDef[] = [
    { field: 'cycleName', header: this.translate.instant('reports.colCycle'), sortable: true },
    { field: 'startDate', header: this.translate.instant('reports.colStart'), sortable: true, type: 'date', width: '110px' },
    { field: 'endDate', header: this.translate.instant('reports.colEnd'), sortable: true, type: 'date', width: '110px' },
    { field: 'totalEntries', header: this.translate.instant('reports.colTotal'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completedEntries', header: this.translate.instant('reports.colDone'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'completionRate', header: this.translate.instant('reports.colRatePercent'), sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'rolledOverCount', header: this.translate.instant('reports.colRolledOver'), sortable: true, type: 'number', width: '110px', align: 'right' },
  ];

  protected readonly rdReportColumns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('reports.colJobNumber'), sortable: true, width: '100px' },
    { field: 'title', header: this.translate.instant('reports.colTitle'), sortable: true },
    { field: 'iterationCount', header: this.translate.instant('reports.colIterations'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalHours', header: this.translate.instant('reports.colHours'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'currentStage', header: this.translate.instant('reports.colStageName'), sortable: true, width: '140px' },
    { field: 'assigneeName', header: this.translate.instant('reports.colAssignee'), sortable: true, width: '140px' },
    { field: 'startDate', header: this.translate.instant('reports.colStart'), sortable: true, type: 'date', width: '100px' },
    { field: 'completedDate', header: this.translate.instant('reports.colCompleted'), sortable: true, type: 'date', width: '100px' },
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
    const done = () => this.loading.set(false);

    switch (id) {
      case 'jobs-by-stage':
        this.reportService.getJobsByStage().subscribe({ next: d => { this.jobsByStageData.set(d); done(); }, error: done });
        break;
      case 'overdue-jobs':
        this.reportService.getOverdueJobs().subscribe({ next: d => { this.overdueJobsData.set(d); done(); }, error: done });
        break;
      case 'time-by-user':
        this.reportService.getTimeByUser(this.startValue(), this.endValue()).subscribe({ next: d => { this.timeByUserData.set(d); done(); }, error: done });
        break;
      case 'expense-summary':
        this.reportService.getExpenseSummary(this.startValue(), this.endValue()).subscribe({ next: d => { this.expenseSummaryData.set(d); done(); }, error: done });
        break;
      case 'lead-pipeline':
        this.reportService.getLeadPipeline().subscribe({ next: d => { this.leadPipelineData.set(d); done(); }, error: done });
        break;
      case 'job-completion-trend':
        this.reportService.getJobCompletionTrend().subscribe({ next: d => { this.completionTrendData.set(d); done(); }, error: done });
        break;
      case 'on-time-delivery':
        this.reportService.getOnTimeDelivery(this.startValue(), this.endValue()).subscribe({ next: d => { this.onTimeDeliveryData.set(d); done(); }, error: done });
        break;
      case 'average-lead-time':
        this.reportService.getAverageLeadTime().subscribe({ next: d => { this.averageLeadTimeData.set(d); done(); }, error: done });
        break;
      case 'team-workload':
        this.reportService.getTeamWorkload().subscribe({ next: d => { this.teamWorkloadData.set(d); done(); }, error: done });
        break;
      case 'customer-activity':
        this.reportService.getCustomerActivity().subscribe({ next: d => { this.customerActivityData.set(d); done(); }, error: done });
        break;
      case 'my-work-history':
        this.reportService.getMyWorkHistory().subscribe({ next: d => { this.myWorkHistoryData.set(d); done(); }, error: done });
        break;
      case 'my-time-log':
        this.reportService.getMyTimeLog(this.startValue(), this.endValue()).subscribe({ next: d => { this.myTimeLogData.set(d); done(); }, error: done });
        break;
      case 'ar-aging':
        this.reportService.getArAging().subscribe({ next: d => { this.arAgingData.set(d); done(); }, error: done });
        break;
      case 'revenue':
        this.reportService.getRevenue(this.startValue(), this.endValue()).subscribe({ next: d => { this.revenueData.set(d); done(); }, error: done });
        break;
      case 'simple-pnl':
        this.reportService.getSimplePnl(this.startValue(), this.endValue()).subscribe({ next: d => { this.simplePnlData.set(d); done(); }, error: done });
        break;
      case 'my-expense-history':
        this.reportService.getMyExpenseHistory(this.startValue(), this.endValue()).subscribe({ next: d => { this.myExpenseHistoryData.set(d); done(); }, error: done });
        break;
      case 'quote-to-close':
        this.reportService.getQuoteToClose(this.startValue(), this.endValue()).subscribe({ next: d => { this.quoteToCloseData.set(d); done(); }, error: done });
        break;
      case 'shipping-summary':
        this.reportService.getShippingSummary(this.startValue(), this.endValue()).subscribe({ next: d => { this.shippingSummaryData.set(d); done(); }, error: done });
        break;
      case 'time-in-stage':
        this.reportService.getTimeInStage().subscribe({ next: d => { this.timeInStageData.set(d); done(); }, error: done });
        break;
      case 'employee-productivity':
        this.reportService.getEmployeeProductivity(this.startValue(), this.endValue()).subscribe({ next: d => { this.employeeProductivityData.set(d); done(); }, error: done });
        break;
      case 'inventory-levels':
        this.reportService.getInventoryLevels().subscribe({ next: d => { this.inventoryLevelsData.set(d); done(); }, error: done });
        break;
      case 'maintenance':
        this.reportService.getMaintenance(this.startValue(), this.endValue()).subscribe({ next: d => { this.maintenanceData.set(d); done(); }, error: done });
        break;
      case 'quality-scrap':
        this.reportService.getQualityScrap(this.startValue(), this.endValue()).subscribe({ next: d => { this.qualityScrapData.set(d); done(); }, error: done });
        break;
      case 'cycle-review':
        this.reportService.getCycleReview().subscribe({ next: d => { this.cycleReviewData.set(d); done(); }, error: done });
        break;
      case 'job-margin':
        this.reportService.getJobMargin(this.startValue(), this.endValue()).subscribe({ next: d => { this.jobMarginData.set(d); done(); }, error: done });
        break;
      case 'my-cycle-summary':
        this.reportService.getMyCycleSummary().subscribe({ next: d => { this.myCycleSummaryData.set(d); done(); }, error: done });
        break;
      case 'lead-sales':
        this.reportService.getLeadSales(this.startValue(), this.endValue()).subscribe({ next: d => { this.leadSalesData.set(d); done(); }, error: done });
        break;
      case 'rd':
        this.reportService.getRdReport(this.startValue(), this.endValue()).subscribe({ next: d => { this.rdReportData.set(d); done(); }, error: done });
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

  protected openReportBuilder(): void {
    this.router.navigate(['/reports/builder']);
  }

  protected readonly arAgingBuckets = computed(() => {
    const data = this.arAgingData();
    const buckets: { key: string; label: string }[] = [
      { key: 'Current', label: this.translate.instant('reports.bucketCurrent') },
      { key: '1-30 Days', label: this.translate.instant('reports.bucket1to30') },
      { key: '31-60 Days', label: this.translate.instant('reports.bucket31to60') },
      { key: '61-90 Days', label: this.translate.instant('reports.bucket61to90') },
      { key: '90+ Days', label: this.translate.instant('reports.bucket90plus') },
    ];
    return buckets.map(b => ({
      bucket: b.key,
      label: b.label,
      total: data.filter(d => d.agingBucket === b.key).reduce((sum, d) => sum + d.balanceDue, 0),
    }));
  });
}
