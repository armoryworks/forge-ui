import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { format } from 'date-fns';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ViewModeToggleComponent } from '../../shared/components/view-mode-toggle/view-mode-toggle.component';
import { ViewMode, DEFAULT_VIEW_MODE } from '../../shared/models/view-mode.model';
import { MatDialog } from '@angular/material/dialog';

import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { toIsoDate } from '../../shared/utils/date.utils';

import { CostingService } from './services/costing.service';
import { CostingRatesVisualComponent } from './components/costing-rates-visual/costing-rates-visual.component';
import { CostingQuickStartDialogComponent } from './components/costing-quick-start-dialog/costing-quick-start-dialog.component';
import { CostingTemplateEditorDialogComponent, CostingTemplateEditorData } from './components/costing-template-editor-dialog/costing-template-editor-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  CostingPeriod,
  CostingCostCenter,
  OverheadPool,
  WorkCenterCostRate,
  CostingTemplate,
} from './models/costing.model';

type CostingTab = 'periods' | 'cost-centers' | 'pools' | 'templates';

@Component({
  selector: 'app-costing',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, DatepickerComponent,
    ToggleComponent, PageLayoutComponent, DataTableComponent, ColumnCellDirective, DatePipe,
    ViewModeToggleComponent, CostingRatesVisualComponent, SpacerDirective,
  ],
  templateUrl: './costing.component.html',
  styleUrl: './costing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CostingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as CostingTab) ?? 'periods')),
    { initialValue: 'periods' as CostingTab },
  );

  /** Local Classic/Visual toggle for the frozen-rates section — URL-only, no accounting pref. */
  protected readonly viewMode = toSignal(
    this.route.queryParamMap.pipe(map(p => (p.get('view') as ViewMode) ?? DEFAULT_VIEW_MODE)),
    { initialValue: DEFAULT_VIEW_MODE },
  );

  protected setViewMode(mode: ViewMode): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === DEFAULT_VIEW_MODE ? null : mode },
      queryParamsHandling: 'merge',
    });
  }

  protected readonly periods = signal<CostingPeriod[]>([]);
  protected readonly costCenters = signal<CostingCostCenter[]>([]);
  protected readonly pools = signal<OverheadPool[]>([]);
  protected readonly rates = signal<WorkCenterCostRate[]>([]);
  protected readonly ratesPeriodId = signal<number | null>(null);
  protected readonly costingTemplates = signal<CostingTemplate[]>([]);

  protected readonly typeOptions: SelectOption[] = [
    { value: 'Production', label: 'Production' },
    { value: 'Support', label: 'Support' },
    { value: 'Sga', label: 'SG&A' },
    { value: 'Warehouse', label: 'Warehouse' },
  ];
  protected readonly behaviorOptions: SelectOption[] = [
    { value: 'Fixed', label: 'Fixed' },
    { value: 'Variable', label: 'Variable' },
    { value: 'Semi', label: 'Semi-variable' },
  ];
  protected readonly driverOptions: SelectOption[] = [
    { value: 'MachineHour', label: 'Machine hour' },
    { value: 'LaborHour', label: 'Labor hour' },
    { value: 'LaborDollar', label: 'Labor dollar' },
    { value: 'MaterialDollar', label: 'Material dollar' },
    { value: 'Unit', label: 'Unit' },
    { value: 'ReceiptCount', label: 'Receipt count' },
  ];

  protected readonly templateColumns: ColumnDef[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'description', header: 'Description' },
    { field: 'lines', header: 'Lines', width: '70px', align: 'center' },
    { field: 'isSystem', header: '', width: '90px' },
    { field: 'actions', header: '', width: '160px' },
  ];

  protected readonly periodColumns: ColumnDef[] = [
    { field: 'startDate', header: 'Start', sortable: true, type: 'date', width: '120px' },
    { field: 'endDate', header: 'End', sortable: true, type: 'date', width: '120px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum' },
    { field: 'frozenAt', header: 'Frozen', sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', align: 'right' },
  ];
  protected readonly rateColumns: ColumnDef[] = [
    { field: 'workCenterId', header: 'Work Center', sortable: true },
    { field: 'laborRate', header: 'Labor', type: 'number', align: 'right' },
    { field: 'laborOhRate', header: 'Labor OH', type: 'number', align: 'right' },
    { field: 'machineRate', header: 'Machine', type: 'number', align: 'right' },
    { field: 'machineOhVarRate', header: 'Mch OH Var', type: 'number', align: 'right' },
    { field: 'machineOhFixedRate', header: 'Mch OH Fixed', type: 'number', align: 'right' },
  ];
  protected readonly costCenterColumns: ColumnDef[] = [
    { field: 'code', header: 'Code', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'type', header: 'Type', sortable: true, filterable: true, type: 'enum' },
    { field: 'sqft', header: 'Sq Ft', type: 'number', align: 'right' },
    { field: 'headcount', header: 'Headcount', type: 'number', align: 'right' },
    { field: 'isInventoriable', header: 'Inventoriable', align: 'center' },
  ];
  protected readonly poolColumns: ColumnDef[] = [
    { field: 'code', header: 'Code', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'behavior', header: 'Behavior', sortable: true, filterable: true, type: 'enum' },
    { field: 'driver', header: 'Driver', sortable: true, filterable: true, type: 'enum' },
  ];

  protected readonly costCenterOptions = computed<SelectOption[]>(() =>
    this.costCenters().map(c => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );
  protected readonly periodOptions = computed<SelectOption[]>(() =>
    this.periods().map(p => ({ value: p.id, label: `${this.fmt(p.startDate)} – ${this.fmt(p.endDate)}` })),
  );
  protected readonly poolOptions = computed<SelectOption[]>(() =>
    this.pools().map(p => ({ value: p.id, label: `${p.code} — ${p.name}` })),
  );

  protected readonly periodForm = this.fb.group({
    start: this.fb.control<Date | null>(null, Validators.required),
    end: this.fb.control<Date | null>(null, Validators.required),
  });
  protected readonly costCenterForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(32)]],
    name: ['', [Validators.required, Validators.maxLength(128)]],
    type: ['Production', Validators.required],
    sqft: this.fb.control<number | null>(null),
    headcount: this.fb.control<number | null>(null),
    isInventoriable: [true],
  });
  protected readonly poolForm = this.fb.group({
    costingCostCenterId: this.fb.control<number | null>(null, Validators.required),
    workCenterId: this.fb.control<number | null>(null),
    code: ['', [Validators.required, Validators.maxLength(32)]],
    name: ['', [Validators.required, Validators.maxLength(128)]],
    behavior: ['Fixed', Validators.required],
    fixedPortion: this.fb.control<number | null>(null),
    driver: ['MachineHour', Validators.required],
  });
  protected readonly budgetForm = this.fb.group({
    overheadCostPoolId: this.fb.control<number | null>(null, Validators.required),
    costingPeriodId: this.fb.control<number | null>(null, Validators.required),
    budgetAmount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    budgetDriverQty: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.0001)]),
  });

  constructor() {
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'periods') this.loadPeriods();
      else if (tab === 'cost-centers') this.loadCostCenters();
      else if (tab === 'pools') { this.loadPools(); this.loadCostCenters(); this.loadPeriods(); }
      else if (tab === 'templates') this.loadTemplates();
    });
  }

  protected switchTab(tab: CostingTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  /** MM/dd/yyyy for select labels (templates use the date pipe directly). */
  protected fmt(iso: string | null): string {
    return iso ? format(new Date(iso), 'MM/dd/yyyy') : '';
  }

  protected loadTemplates(): void {
    this.service.getTemplates().subscribe({
      next: (templates) => this.costingTemplates.set(templates),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'costing.templates.loadFailed'),
    });
  }

  protected openTemplateEditor(template: CostingTemplate | null): void {
    this.dialog.open(CostingTemplateEditorDialogComponent, {
      width: '800px',
      data: { template } satisfies CostingTemplateEditorData,
    }).afterClosed().subscribe((saved) => {
      if (!saved) return;
      this.snackbar.success(this.translate.instant('costing.templates.saved', { name: saved.name }));
      this.loadTemplates();
    });
  }

  protected deleteTemplate(template: CostingTemplate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('costing.templates.deleteTitle'),
        message: this.translate.instant('costing.templates.deleteMessage', { name: template.name }),
        confirmLabel: this.translate.instant('costing.templates.deleteConfirm'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.deleteTemplate(template.id).subscribe({
        next: () => this.loadTemplates(),
        error: (err: unknown) => this.snackbar.errorFrom(err, 'costing.templates.deleteFailed'),
      });
    });
  }

  /** Prepackaged setup: a few answers populate pools, budgets, and GL budget lines. */
  protected openQuickStart(): void {
    this.dialog.open(CostingQuickStartDialogComponent, { width: '520px' })
      .afterClosed().subscribe((result) => {
        if (!result) return;
        this.snackbar.success(this.translate.instant('costing.quickStart.applied', {
          pools: result.poolsConfigured.length,
          rate: result.overheadRatePerLaborHour,
        }));
        if (result.notes.length) {
          this.toast.show({
            severity: 'info',
            title: this.translate.instant('costing.quickStart.title'),
            message: result.notes.join('\n'),
          });
        }
        this.loadPeriods();
        this.loadCostCenters();
        this.loadPools();
      });
  }

  private loadPeriods(): void {
    this.service.listPeriods().subscribe({
      next: r => this.periods.set(r),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costingPeriodsLoadFailed'),
    });
  }
  private loadCostCenters(): void {
    this.service.listCostCenters().subscribe({
      next: r => this.costCenters.set(r),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costCentersLoadFailed'),
    });
  }
  private loadPools(): void {
    this.service.listPools().subscribe({
      next: r => this.pools.set(r),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.overheadPoolsLoadFailed'),
    });
  }

  protected createPeriod(): void {
    if (this.periodForm.invalid) return;
    const v = this.periodForm.getRawValue();
    const start = toIsoDate(v.start);
    const end = toIsoDate(v.end);
    if (!start || !end) return;
    this.service.createPeriod(start, end).subscribe({
      next: () => { this.snackbar.success('Period created'); this.periodForm.reset(); this.loadPeriods(); },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costingPeriodCreateFailed'),
    });
  }

  protected freeze(period: CostingPeriod): void {
    this.service.freezePeriod(period.id).subscribe({
      next: r => { this.snackbar.success(`Frozen: ${r.budgetsRated} budget(s), ${r.workCentersRated} rate(s)`); this.loadPeriods(); this.viewRates(period.id); },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costingPeriodFreezeFailed'),
    });
  }

  protected viewRates(periodId: number): void {
    this.ratesPeriodId.set(periodId);
    this.service.listRates(periodId).subscribe({
      next: r => this.rates.set(r),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costingRatesLoadFailed'),
    });
  }

  protected createCostCenter(): void {
    if (this.costCenterForm.invalid) return;
    const v = this.costCenterForm.getRawValue();
    this.service.createCostCenter({
      code: v.code!, name: v.name!, type: v.type as CostingCostCenter['type'],
      parentId: null, sqft: v.sqft, headcount: v.headcount, isInventoriable: v.isInventoriable!,
    }).subscribe({
      next: () => { this.snackbar.success('Cost center created'); this.costCenterForm.reset({ type: 'Production', isInventoriable: true }); this.loadCostCenters(); },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.costCenterCreateFailed'),
    });
  }

  protected createPool(): void {
    if (this.poolForm.invalid) return;
    const v = this.poolForm.getRawValue();
    this.service.createPool({
      costingCostCenterId: v.costingCostCenterId!, workCenterId: v.workCenterId,
      code: v.code!, name: v.name!, behavior: v.behavior as OverheadPool['behavior'],
      fixedPortion: v.fixedPortion, driver: v.driver as OverheadPool['driver'],
    }).subscribe({
      next: () => { this.snackbar.success('Pool created'); this.poolForm.reset({ behavior: 'Fixed', driver: 'MachineHour' }); this.loadPools(); },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.overheadPoolCreateFailed'),
    });
  }

  protected setBudget(): void {
    if (this.budgetForm.invalid) return;
    const v = this.budgetForm.getRawValue();
    this.service.upsertBudget(v.overheadCostPoolId!, v.costingPeriodId!, v.budgetAmount!, v.budgetDriverQty!).subscribe({
      next: r => { this.snackbar.success(`Budget set — rate ${r.derivedRate.toFixed(4)}`); this.budgetForm.reset(); },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.overheadBudgetSetFailed'),
    });
  }
}
