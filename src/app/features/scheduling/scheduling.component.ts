import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { KpiChipComponent } from '../../shared/components/kpi-chip/kpi-chip.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { ToolbarComponent } from '../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ColumnDef } from '../../shared/models/column-def.model';

import { SchedulingService } from './services/scheduling.service';
import {
  ScheduleRun,
  ScheduledOperation,
  WorkCenter,
  DispatchListItem,
  WorkCenterLoad,
  Shift,
} from './models/scheduling.model';

type SchedulingTab = 'gantt' | 'dispatch' | 'work-centers' | 'shifts' | 'runs';

const VALID_TABS = new Set<SchedulingTab>(['gantt', 'dispatch', 'work-centers', 'shifts', 'runs']);

@Component({
  selector: 'app-scheduling',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    ColumnCellDirective,
    KpiChipComponent,
    SelectComponent,
    ToolbarComponent,
    SpacerDirective,
    EmptyStateComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './scheduling.component.html',
  styleUrl: './scheduling.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly schedulingService = inject(SchedulingService);
  private readonly snackbar = inject(SnackbarService);

  // Tab state from URL
  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map(p => {
        const tab = p.get('tab') as SchedulingTab;
        return VALID_TABS.has(tab) ? tab : 'gantt';
      }),
    ),
    { initialValue: 'gantt' as SchedulingTab },
  );

  // Data signals
  protected readonly ganttOps = signal<ScheduledOperation[]>([]);
  protected readonly workCenters = signal<WorkCenter[]>([]);
  protected readonly shifts = signal<Shift[]>([]);
  protected readonly scheduleRuns = signal<ScheduleRun[]>([]);
  protected readonly dispatchList = signal<DispatchListItem[]>([]);
  protected readonly workCenterLoad = signal<WorkCenterLoad | null>(null);
  protected readonly loading = signal(false);

  // Work center select for dispatch/load
  protected readonly selectedWorkCenterControl = new FormControl<number | null>(null);
  protected readonly workCenterOptions = computed<SelectOption[]>(() =>
    this.workCenters().map(wc => ({ value: wc.id, label: `${wc.code} - ${wc.name}` })),
  );

  // Priority rule options
  protected readonly priorityOptions: SelectOption[] = [
    { value: 'DueDate', label: 'Due Date' },
    { value: 'Priority', label: 'Priority' },
    { value: 'FIFO', label: 'FIFO (First In)' },
  ];

  // KPIs
  protected readonly totalScheduled = computed(() =>
    this.ganttOps().filter(o => o.status === 'Scheduled').length,
  );
  protected readonly totalInProgress = computed(() =>
    this.ganttOps().filter(o => o.status === 'InProgress').length,
  );
  protected readonly totalWorkCenters = computed(() =>
    this.workCenters().filter(wc => wc.isActive).length,
  );

  // Column definitions
  protected readonly ganttColumns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'operationTitle', header: 'Operation', sortable: true },
    { field: 'workCenterName', header: 'Work Center', sortable: true, filterable: true, type: 'text' },
    { field: 'scheduledStart', header: 'Start', sortable: true, type: 'date', width: '140px' },
    { field: 'scheduledEnd', header: 'End', sortable: true, type: 'date', width: '140px' },
    { field: 'totalHours', header: 'Hours', sortable: true, type: 'number', width: '80px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Scheduled', label: 'Scheduled' },
        { value: 'InProgress', label: 'In Progress' },
        { value: 'Complete', label: 'Complete' },
      ] },
    { field: 'isLocked', header: 'Locked', sortable: true, width: '70px' },
  ];

  protected readonly workCenterColumns: ColumnDef[] = [
    { field: 'code', header: 'Code', sortable: true, width: '100px' },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'dailyCapacityHours', header: 'Daily Cap (hrs)', sortable: true, type: 'number', width: '120px' },
    { field: 'efficiencyPercent', header: 'Efficiency %', sortable: true, type: 'number', width: '110px' },
    { field: 'numberOfMachines', header: 'Machines', sortable: true, type: 'number', width: '90px' },
    { field: 'isActive', header: 'Active', sortable: true, width: '70px' },
    { field: 'assetName', header: 'Asset', sortable: true },
    { field: 'locationName', header: 'Location', sortable: true },
  ];

  protected readonly shiftColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'startTime', header: 'Start', sortable: true, width: '100px' },
    { field: 'endTime', header: 'End', sortable: true, width: '100px' },
    { field: 'breakMinutes', header: 'Break (min)', sortable: true, type: 'number', width: '100px' },
    { field: 'netHours', header: 'Net Hours', sortable: true, type: 'number', width: '100px' },
    { field: 'isActive', header: 'Active', sortable: true, width: '70px' },
  ];

  protected readonly runColumns: ColumnDef[] = [
    { field: 'runDate', header: 'Run Date', sortable: true, type: 'date', width: '140px' },
    { field: 'direction', header: 'Direction', sortable: true, width: '100px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'Completed', label: 'Completed' },
        { value: 'Running', label: 'Running' },
        { value: 'Failed', label: 'Failed' },
      ] },
    { field: 'operationsScheduled', header: 'Ops Scheduled', sortable: true, type: 'number', width: '120px' },
    { field: 'conflictsDetected', header: 'Conflicts', sortable: true, type: 'number', width: '100px' },
    { field: 'completedAt', header: 'Completed', sortable: true, type: 'date', width: '140px' },
  ];

  protected readonly dispatchColumns: ColumnDef[] = [
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '100px' },
    { field: 'operationTitle', header: 'Operation', sortable: true },
    { field: 'sequenceNumber', header: 'Seq', sortable: true, type: 'number', width: '60px' },
    { field: 'scheduledStart', header: 'Start', sortable: true, type: 'date', width: '140px' },
    { field: 'setupHours', header: 'Setup (hrs)', sortable: true, type: 'number', width: '100px' },
    { field: 'runHours', header: 'Run (hrs)', sortable: true, type: 'number', width: '100px' },
    { field: 'priority', header: 'Priority', sortable: true, width: '90px' },
    { field: 'jobDueDate', header: 'Due Date', sortable: true, type: 'date', width: '120px' },
  ];

  constructor() {
    // Load work centers on init (needed for dispatch selector)
    this.loadWorkCenters();

    // Lazy load tab data
    effect(() => {
      const tab = this.activeTab();
      switch (tab) {
        case 'gantt':
          this.loadGanttData();
          break;
        case 'work-centers':
          this.loadWorkCenters();
          break;
        case 'shifts':
          this.loadShifts();
          break;
        case 'runs':
          this.loadRuns();
          break;
        case 'dispatch':
          // Loaded when work center is selected
          break;
      }
    });
  }

  protected switchTab(tab: string): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  // Data loading
  private loadGanttData(): void {
    this.loading.set(true);
    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    this.schedulingService.getGanttData(from, to).subscribe({
      next: ops => { this.ganttOps.set(ops); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadWorkCenters(): void {
    this.schedulingService.getWorkCenters().subscribe({
      next: wcs => this.workCenters.set(wcs),
    });
  }

  private loadShifts(): void {
    this.loading.set(true);
    this.schedulingService.getShifts().subscribe({
      next: s => { this.shifts.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadRuns(): void {
    this.loading.set(true);
    this.schedulingService.getScheduleRuns().subscribe({
      next: r => { this.scheduleRuns.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected loadDispatch(): void {
    const wcId = this.selectedWorkCenterControl.value;
    if (!wcId) return;
    this.loading.set(true);
    this.schedulingService.getDispatchList(wcId).subscribe({
      next: d => { this.dispatchList.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // Actions
  protected executeSchedule(): void {
    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    this.schedulingService.runScheduler({
      direction: 'Forward',
      scheduleFrom: from,
      scheduleTo: to,
      priorityRule: 'DueDate',
    }).subscribe({
      next: run => {
        this.snackbar.success(`Scheduled ${run.operationsScheduled} operations`);
        this.loadGanttData();
        this.loadRuns();
      },
    });
  }

  protected toggleLock(op: ScheduledOperation): void {
    this.schedulingService.lockOperation(op.id, !op.isLocked).subscribe({
      next: () => {
        this.snackbar.success(op.isLocked ? 'Operation unlocked' : 'Operation locked');
        this.loadGanttData();
      },
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Scheduled': return 'chip chip--info';
      case 'InProgress': return 'chip chip--warning';
      case 'Complete': return 'chip chip--success';
      case 'Cancelled': return 'chip chip--muted';
      case 'Completed': return 'chip chip--success';
      case 'Running': return 'chip chip--warning';
      case 'Failed': return 'chip chip--error';
      default: return 'chip';
    }
  }
}
