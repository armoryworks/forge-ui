import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { ToolbarComponent } from '../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ColumnDef } from '../../shared/models/column-def.model';
import { SelectOption } from '../../shared/components/select/select.component';

import { MrpService } from './services/mrp.service';
import {
  MrpRun,
  MrpPlannedOrder,
  MrpException,
  MasterSchedule,
  DemandForecast,
} from './models/mrp.model';

type MrpTab = 'dashboard' | 'planned-orders' | 'exceptions' | 'runs' | 'master-schedule' | 'forecasts';

const VALID_TABS = new Set<MrpTab>(['dashboard', 'planned-orders', 'exceptions', 'runs', 'master-schedule', 'forecasts']);

@Component({
  selector: 'app-mrp',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    ColumnCellDirective,
    KpiChipComponent,
    InputComponent,
    SelectComponent,
    ToolbarComponent,
    SpacerDirective,
    EmptyStateComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './mrp.component.html',
  styleUrl: './mrp.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrpComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mrpService = inject(MrpService);
  private readonly snackbar = inject(SnackbarService);

  // Tab state from URL
  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map(p => {
        const tab = p.get('tab') as MrpTab;
        return VALID_TABS.has(tab) ? tab : 'dashboard';
      }),
    ),
    { initialValue: 'dashboard' as MrpTab },
  );

  // Loading states
  protected readonly loadingRuns = signal(false);
  protected readonly loadingOrders = signal(false);
  protected readonly loadingExceptions = signal(false);
  protected readonly loadingSchedules = signal(false);
  protected readonly loadingForecasts = signal(false);
  protected readonly executingRun = signal(false);

  // Data signals
  protected readonly runs = signal<MrpRun[]>([]);
  protected readonly plannedOrders = signal<MrpPlannedOrder[]>([]);
  protected readonly exceptions = signal<MrpException[]>([]);
  protected readonly masterSchedules = signal<MasterSchedule[]>([]);
  protected readonly forecasts = signal<DemandForecast[]>([]);

  // Dashboard KPIs
  protected readonly latestRun = computed(() => this.runs()[0] ?? null);
  protected readonly unresolvedExceptionCount = computed(() => this.exceptions().filter(e => !e.isResolved).length);
  protected readonly plannedOrderCount = computed(() => this.plannedOrders().filter(o => o.status === 'Planned').length);
  protected readonly firmedOrderCount = computed(() => this.plannedOrders().filter(o => o.status === 'Firmed').length);

  // Filters
  protected readonly orderStatusControl = new FormControl<string | null>(null);
  protected readonly exceptionFilterControl = new FormControl<string | null>('unresolved');

  protected readonly orderStatusOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'Planned', label: 'Planned' },
    { value: 'Firmed', label: 'Firmed' },
    { value: 'Released', label: 'Released' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  protected readonly exceptionFilterOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'unresolved', label: 'Unresolved Only' },
  ];

  // Column definitions
  protected readonly runColumns: ColumnDef[] = [
    { field: 'runNumber', header: 'Run #', sortable: true, width: '160px' },
    { field: 'runType', header: 'Type', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [{ value: 'Full', label: 'Full' }, { value: 'NetChange', label: 'Net Change' }, { value: 'Simulation', label: 'Simulation' }] },
    { field: 'status', header: 'Status', sortable: true, width: '100px' },
    { field: 'plannedOrderCount', header: 'Orders', sortable: true, width: '80px', align: 'right' },
    { field: 'exceptionCount', header: 'Exceptions', sortable: true, width: '90px', align: 'right' },
    { field: 'totalDemandCount', header: 'Demands', sortable: true, width: '80px', align: 'right' },
    { field: 'totalSupplyCount', header: 'Supplies', sortable: true, width: '80px', align: 'right' },
    { field: 'startedAt', header: 'Started', sortable: true, type: 'date', width: '140px' },
    { field: 'completedAt', header: 'Completed', sortable: true, type: 'date', width: '140px' },
  ];

  protected readonly orderColumns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'orderType', header: 'Type', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [{ value: 'Purchase', label: 'Purchase' }, { value: 'Manufacture', label: 'Manufacture' }] },
    { field: 'status', header: 'Status', sortable: true, width: '90px' },
    { field: 'quantity', header: 'Qty', sortable: true, width: '80px', align: 'right' },
    { field: 'startDate', header: 'Start', sortable: true, type: 'date', width: '110px' },
    { field: 'dueDate', header: 'Due', sortable: true, type: 'date', width: '110px' },
    { field: 'isFirmed', header: 'Firmed', sortable: true, width: '70px' },
    { field: 'actions', header: '', width: '90px' },
  ];

  protected readonly exceptionColumns: ColumnDef[] = [
    { field: 'exceptionType', header: 'Type', sortable: true, filterable: true, type: 'enum', width: '120px',
      filterOptions: [
        { value: 'Expedite', label: 'Expedite' }, { value: 'Defer', label: 'Defer' },
        { value: 'Cancel', label: 'Cancel' }, { value: 'PastDue', label: 'Past Due' },
        { value: 'ShortSupply', label: 'Short Supply' }, { value: 'OverSupply', label: 'Over Supply' },
        { value: 'LeadTimeViolation', label: 'Lead Time' },
      ] },
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'message', header: 'Message', sortable: false },
    { field: 'suggestedAction', header: 'Suggested Action', sortable: false },
    { field: 'isResolved', header: 'Resolved', sortable: true, width: '80px' },
    { field: 'actions', header: '', width: '80px' },
  ];

  protected readonly scheduleColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Draft', label: 'Draft' }, { value: 'Active', label: 'Active' },
        { value: 'Completed', label: 'Completed' }, { value: 'Cancelled', label: 'Cancelled' },
      ] },
    { field: 'periodStart', header: 'Start', sortable: true, type: 'date', width: '110px' },
    { field: 'periodEnd', header: 'End', sortable: true, type: 'date', width: '110px' },
    { field: 'lineCount', header: 'Lines', sortable: true, width: '70px', align: 'right' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected readonly forecastColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'method', header: 'Method', sortable: true, width: '160px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Draft', label: 'Draft' }, { value: 'Approved', label: 'Approved' },
        { value: 'Applied', label: 'Applied' }, { value: 'Expired', label: 'Expired' },
      ] },
    { field: 'forecastPeriods', header: 'Periods', sortable: true, width: '80px', align: 'right' },
    { field: 'overrideCount', header: 'Overrides', sortable: true, width: '90px', align: 'right' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    // Load data when tab changes
    effect(() => {
      const tab = this.activeTab();
      switch (tab) {
        case 'dashboard':
          this.loadRuns();
          this.loadPlannedOrders();
          this.loadExceptions();
          break;
        case 'planned-orders':
          this.loadPlannedOrders();
          break;
        case 'exceptions':
          this.loadExceptions();
          break;
        case 'runs':
          this.loadRuns();
          break;
        case 'master-schedule':
          this.loadMasterSchedules();
          break;
        case 'forecasts':
          this.loadForecasts();
          break;
      }
    });
  }

  protected switchTab(tab: string): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected executeRun(simulate = false): void {
    this.executingRun.set(true);
    const request = { runType: 'Full' as const, planningHorizonDays: 90 };
    const call = simulate ? this.mrpService.simulateRun(request) : this.mrpService.executeRun(request);
    call.subscribe({
      next: (run) => {
        this.executingRun.set(false);
        this.snackbar.success(`MRP ${simulate ? 'simulation' : 'run'} completed: ${run.plannedOrderCount} orders, ${run.exceptionCount} exceptions`);
        this.loadRuns();
        this.loadPlannedOrders();
        this.loadExceptions();
      },
      error: () => this.executingRun.set(false),
    });
  }

  protected firmOrder(order: MrpPlannedOrder): void {
    this.mrpService.updatePlannedOrder(order.id, true).subscribe({
      next: () => {
        this.snackbar.success('Order firmed');
        this.loadPlannedOrders();
      },
    });
  }

  protected releaseOrder(order: MrpPlannedOrder): void {
    this.mrpService.releasePlannedOrder(order.id).subscribe({
      next: (result) => {
        this.snackbar.success(`Released as ${result.createdEntityType} #${result.createdEntityId}`);
        this.loadPlannedOrders();
      },
    });
  }

  protected resolveException(exception: MrpException): void {
    this.mrpService.resolveException(exception.id, 'Resolved').subscribe({
      next: () => {
        this.snackbar.success('Exception resolved');
        this.loadExceptions();
      },
    });
  }

  protected activateSchedule(schedule: MasterSchedule): void {
    this.mrpService.activateMasterSchedule(schedule.id).subscribe({
      next: () => {
        this.snackbar.success('Schedule activated');
        this.loadMasterSchedules();
      },
    });
  }

  protected approveForecast(forecast: DemandForecast): void {
    this.mrpService.approveForecast(forecast.id).subscribe({
      next: () => {
        this.snackbar.success('Forecast approved');
        this.loadForecasts();
      },
    });
  }

  protected getRunStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'chip chip--success';
      case 'Running': return 'chip chip--info';
      case 'Failed': return 'chip chip--error';
      case 'Queued': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected getOrderStatusClass(status: string): string {
    switch (status) {
      case 'Planned': return 'chip chip--info';
      case 'Firmed': return 'chip chip--warning';
      case 'Released': return 'chip chip--success';
      case 'Cancelled': return 'chip chip--muted';
      default: return 'chip';
    }
  }

  protected getExceptionTypeClass(type: string): string {
    switch (type) {
      case 'Expedite': case 'PastDue': return 'chip chip--error';
      case 'Defer': case 'OverSupply': return 'chip chip--warning';
      case 'Cancel': return 'chip chip--muted';
      case 'ShortSupply': case 'LeadTimeViolation': return 'chip chip--error';
      default: return 'chip';
    }
  }

  protected getScheduleStatusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'chip chip--muted';
      case 'Active': return 'chip chip--success';
      case 'Completed': return 'chip chip--info';
      case 'Cancelled': return 'chip chip--error';
      default: return 'chip';
    }
  }

  protected getForecastStatusClass(status: string): string {
    switch (status) {
      case 'Draft': return 'chip chip--muted';
      case 'Approved': return 'chip chip--success';
      case 'Applied': return 'chip chip--info';
      case 'Expired': return 'chip chip--warning';
      default: return 'chip';
    }
  }

  private loadRuns(): void {
    if (this.loadingRuns()) return;
    this.loadingRuns.set(true);
    this.mrpService.getRuns().subscribe({
      next: (data) => { this.runs.set(data); this.loadingRuns.set(false); },
      error: () => this.loadingRuns.set(false),
    });
  }

  private loadPlannedOrders(): void {
    if (this.loadingOrders()) return;
    this.loadingOrders.set(true);
    this.mrpService.getPlannedOrders().subscribe({
      next: (data) => { this.plannedOrders.set(data); this.loadingOrders.set(false); },
      error: () => this.loadingOrders.set(false),
    });
  }

  private loadExceptions(): void {
    if (this.loadingExceptions()) return;
    this.loadingExceptions.set(true);
    this.mrpService.getExceptions(undefined, true).subscribe({
      next: (data) => { this.exceptions.set(data); this.loadingExceptions.set(false); },
      error: () => this.loadingExceptions.set(false),
    });
  }

  private loadMasterSchedules(): void {
    if (this.loadingSchedules()) return;
    this.loadingSchedules.set(true);
    this.mrpService.getMasterSchedules().subscribe({
      next: (data) => { this.masterSchedules.set(data); this.loadingSchedules.set(false); },
      error: () => this.loadingSchedules.set(false),
    });
  }

  private loadForecasts(): void {
    if (this.loadingForecasts()) return;
    this.loadingForecasts.set(true);
    this.mrpService.getForecasts().subscribe({
      next: (data) => { this.forecasts.set(data); this.loadingForecasts.set(false); },
      error: () => this.loadingForecasts.set(false),
    });
  }
}
