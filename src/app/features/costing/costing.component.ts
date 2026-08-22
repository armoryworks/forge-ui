import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { toIsoDate } from '../../shared/utils/date.utils';

import { CostingService } from './services/costing.service';
import {
  CostingPeriod,
  CostingCostCenter,
  OverheadPool,
  WorkCenterCostRate,
} from './models/costing.model';

type CostingTab = 'periods' | 'cost-centers' | 'pools';

@Component({
  selector: 'app-costing',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, DatepickerComponent,
    ToggleComponent, PageLayoutComponent, DataTableComponent, ColumnCellDirective,
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

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => (p.get('tab') as CostingTab) ?? 'periods')),
    { initialValue: 'periods' as CostingTab },
  );

  protected readonly periods = signal<CostingPeriod[]>([]);
  protected readonly costCenters = signal<CostingCostCenter[]>([]);
  protected readonly pools = signal<OverheadPool[]>([]);
  protected readonly rates = signal<WorkCenterCostRate[]>([]);
  protected readonly ratesPeriodId = signal<number | null>(null);

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
    });
  }

  protected switchTab(tab: CostingTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected fmt(iso: string | null): string {
    return iso ? new Date(iso).toLocaleDateString('en-US') : '';
  }

  private loadPeriods(): void {
    this.service.listPeriods().subscribe({
      next: r => this.periods.set(r),
      error: () => this.snackbar.error('Failed to load costing periods'),
    });
  }
  private loadCostCenters(): void {
    this.service.listCostCenters().subscribe({
      next: r => this.costCenters.set(r),
      error: () => this.snackbar.error('Failed to load cost centers'),
    });
  }
  private loadPools(): void {
    this.service.listPools().subscribe({
      next: r => this.pools.set(r),
      error: () => this.snackbar.error('Failed to load overhead pools'),
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
      error: () => this.snackbar.error('Failed to create period'),
    });
  }

  protected freeze(period: CostingPeriod): void {
    this.service.freezePeriod(period.id).subscribe({
      next: r => { this.snackbar.success(`Frozen: ${r.budgetsRated} budget(s), ${r.workCentersRated} rate(s)`); this.loadPeriods(); this.viewRates(period.id); },
      error: () => this.snackbar.error('Freeze failed'),
    });
  }

  protected viewRates(periodId: number): void {
    this.ratesPeriodId.set(periodId);
    this.service.listRates(periodId).subscribe({
      next: r => this.rates.set(r),
      error: () => this.snackbar.error('Failed to load rates'),
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
      error: () => this.snackbar.error('Failed to create cost center'),
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
      error: () => this.snackbar.error('Failed to create pool'),
    });
  }

  protected setBudget(): void {
    if (this.budgetForm.invalid) return;
    const v = this.budgetForm.getRawValue();
    this.service.upsertBudget(v.overheadCostPoolId!, v.costingPeriodId!, v.budgetAmount!, v.budgetDriverQty!).subscribe({
      next: r => { this.snackbar.success(`Budget set — rate ${r.derivedRate.toFixed(4)}`); this.budgetForm.reset(); },
      error: () => this.snackbar.error('Failed to set budget'),
    });
  }
}
