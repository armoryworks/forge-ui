import { ChangeDetectionStrategy, Component, effect, inject, signal, computed, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { QualityService } from './services/quality.service';
import { QcInspection } from './models/qc-inspection.model';
import { QcTemplate } from './models/qc-template.model';
import { LotRecord } from './models/lot-record.model';
import { LotTraceability } from './models/lot-traceability.model';
import { SpcCharacteristic } from './models/spc.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SpcCharacteristicsComponent } from './components/spc-characteristics.component';
import { SpcChartComponent } from './components/spc-chart.component';
import { SpcDataEntryComponent } from './components/spc-data-entry.component';
import { SpcOocListComponent } from './components/spc-ooc-list.component';
import { NcrListComponent } from './components/ncr-list.component';
import { CapaListComponent } from './components/capa-list.component';
import { EcoListComponent } from './components/eco-list.component';
import { GageListComponent } from './components/gage-list.component';

type QualityTab = 'inspections' | 'lots' | 'spc-charts' | 'spc-data' | 'spc-ooc' | 'ncrs' | 'capas' | 'ecos' | 'gages';

const VALID_TABS: QualityTab[] = ['inspections', 'lots', 'spc-charts', 'spc-data', 'spc-ooc', 'ncrs', 'capas', 'ecos', 'gages'];

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent,
    DataTableComponent, ColumnCellDirective,
    ValidationPopoverDirective, LoadingBlockDirective,
    TranslatePipe, MatTooltipModule,
    SpcCharacteristicsComponent, SpcChartComponent,
    SpcDataEntryComponent, SpcOocListComponent,
    NcrListComponent, CapaListComponent, EcoListComponent,
    GageListComponent,
  ],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityComponent {
  private readonly qualityService = inject(QualityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild(SpcCharacteristicsComponent) spcCharsComponent?: SpcCharacteristicsComponent;
  @ViewChild(NcrListComponent) ncrListComponent?: NcrListComponent;
  @ViewChild(CapaListComponent) capaListComponent?: CapaListComponent;
  @ViewChild(EcoListComponent) ecoListComponent?: EcoListComponent;
  @ViewChild(GageListComponent) gageListComponent?: GageListComponent;

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(map(p => {
      const tab = p.get('tab') as QualityTab;
      return VALID_TABS.includes(tab) ? tab : 'inspections';
    })),
    { initialValue: 'inspections' as QualityTab },
  );

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  // SPC state
  protected readonly selectedCharacteristic = signal<SpcCharacteristic | null>(null);

  // ─── Inspections ───
  protected readonly inspections = signal<QcInspection[]>([]);
  protected readonly templates = signal<QcTemplate[]>([]);
  protected readonly showInspectionDialog = signal(false);

  protected readonly statusFilterControl = new FormControl<string>('');
  protected readonly inspectionSearchControl = new FormControl('');

  protected readonly inspectionColumns: ColumnDef[] = [
    { field: 'createdAt', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '120px' },
    { field: 'jobNumber', header: this.translate.instant('reports.colJob'), sortable: true, width: '100px' },
    { field: 'templateName', header: this.translate.instant('quality.template'), sortable: true },
    { field: 'inspectorName', header: this.translate.instant('quality.inspector'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('quality.lotNumber'), sortable: true, width: '140px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '100px',
      filterOptions: [
        { value: 'InProgress', label: this.translate.instant('quality.statusInProgress') },
        { value: 'Passed', label: this.translate.instant('quality.statusPassed') },
        { value: 'Failed', label: this.translate.instant('quality.statusFailed') },
      ]},
    { field: 'resultsSummary', header: this.translate.instant('quality.resultsSummary'), width: '100px', align: 'center' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('common.allStatuses') },
    { value: 'InProgress', label: this.translate.instant('quality.statusInProgress') },
    { value: 'Passed', label: this.translate.instant('quality.statusPassed') },
    { value: 'Failed', label: this.translate.instant('quality.statusFailed') },
  ];

  protected readonly templateOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('common.none') },
    ...this.templates().map(t => ({ value: t.id, label: t.name })),
  ]);

  protected readonly inspectionForm = new FormGroup({
    jobId: new FormControl<number | null>(null),
    templateId: new FormControl<number | null>(null),
    lotNumber: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly inspectionViolations = FormValidationService.getViolations(this.inspectionForm, {
    jobId: 'Job',
    templateId: 'Template',
    lotNumber: 'Lot Number',
    notes: 'Notes',
  });

  // ─── Lots ───
  protected readonly lots = signal<LotRecord[]>([]);
  protected readonly lotSearchControl = new FormControl('');
  protected readonly showLotDialog = signal(false);
  protected readonly showTraceDialog = signal(false);
  protected readonly traceData = signal<LotTraceability | null>(null);

  protected readonly lotColumns: ColumnDef[] = [
    { field: 'lotNumber', header: this.translate.instant('quality.lotNumber'), sortable: true, width: '160px' },
    { field: 'partNumber', header: this.translate.instant('reports.colPartNumber'), sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true },
    { field: 'quantity', header: this.translate.instant('common.quantity'), sortable: true, width: '80px', align: 'right' },
    { field: 'jobNumber', header: this.translate.instant('reports.colJob'), sortable: true, width: '100px' },
    { field: 'supplierLotNumber', header: this.translate.instant('quality.supplierLotNumber'), sortable: true, width: '140px' },
    { field: 'expirationDate', header: this.translate.instant('quality.expires'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.created'), sortable: true, type: 'date', width: '110px' },
    { field: 'actions', header: '', width: '50px', align: 'center' },
  ];

  protected readonly lotForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(1)]),
    lotNumber: new FormControl(''),
    jobId: new FormControl<number | null>(null),
    supplierLotNumber: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly lotViolations = FormValidationService.getViolations(this.lotForm, {
    partId: 'Part',
    quantity: 'Quantity',
    lotNumber: 'Lot Number',
    jobId: 'Job',
    supplierLotNumber: 'Supplier Lot',
    notes: 'Notes',
  });

  constructor() {
    this.scanner.setContext('quality');
    this.loadInspections();
    this.loadTemplates();

    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'quality') return;
      this.scanner.clearLastScan();
      if (this.activeTab() === 'lots') {
        this.lotSearchControl.setValue(scan.value);
      } else {
        this.inspectionSearchControl.setValue(scan.value);
      }
    });

    // Load data when switching tabs
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'lots') this.loadLots();
      if (tab === 'inspections') this.loadInspections();
    });
  }

  protected switchTab(tab: QualityTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected onCharacteristicSelected(char: SpcCharacteristic): void {
    this.selectedCharacteristic.set(char);
    this.switchTab('spc-charts');
  }

  protected onMeasurementRecorded(): void {
    // Refresh the characteristics list for updated measurement count
    this.spcCharsComponent?.loadCharacteristics();
  }

  // ─── Inspection Methods ───

  protected loadInspections(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value || undefined;
    this.qualityService.getInspections({ status }).subscribe({
      next: (data) => { this.inspections.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected loadTemplates(): void {
    this.qualityService.getTemplates().subscribe({
      next: (data) => this.templates.set(data),
    });
  }

  protected applyInspectionFilters(): void {
    this.loadInspections();
  }

  protected openCreateInspection(): void {
    this.inspectionForm.reset();
    this.showInspectionDialog.set(true);
  }

  protected closeInspectionDialog(): void {
    this.showInspectionDialog.set(false);
  }

  protected saveInspection(): void {
    this.saving.set(true);
    const form = this.inspectionForm.getRawValue();
    this.qualityService.createInspection({
      jobId: form.jobId ?? undefined,
      templateId: form.templateId ?? undefined,
      lotNumber: form.lotNumber || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeInspectionDialog();
        this.loadInspections();
        this.snackbar.success(this.translate.instant('quality.inspectionCreated'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      InProgress: 'chip--warning',
      Passed: 'chip--success',
      Failed: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    return status === 'InProgress' ? 'In Progress' : status;
  }

  protected getResultsSummary(inspection: QcInspection): string {
    if (!inspection.results || inspection.results.length === 0) return '—';
    const passed = inspection.results.filter(r => r.passed).length;
    return `${passed}/${inspection.results.length}`;
  }

  // ─── Lot Methods ───

  protected loadLots(): void {
    this.loading.set(true);
    const search = this.lotSearchControl.value?.trim() || undefined;
    this.qualityService.getLotRecords({ search }).subscribe({
      next: (data) => { this.lots.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyLotFilters(): void {
    this.loadLots();
  }

  protected openCreateLot(): void {
    this.lotForm.reset({ quantity: 1 });
    this.showLotDialog.set(true);
  }

  protected closeLotDialog(): void {
    this.showLotDialog.set(false);
  }

  protected saveLot(): void {
    if (this.lotForm.invalid) return;
    this.saving.set(true);
    const form = this.lotForm.getRawValue();
    this.qualityService.createLotRecord({
      partId: form.partId!,
      quantity: form.quantity!,
      lotNumber: form.lotNumber || undefined,
      jobId: form.jobId ?? undefined,
      supplierLotNumber: form.supplierLotNumber || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeLotDialog();
        this.loadLots();
        this.snackbar.success(this.translate.instant('quality.lotCreated'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected viewTraceability(lot: LotRecord): void {
    this.qualityService.getLotTraceability(lot.lotNumber).subscribe({
      next: (data) => {
        this.traceData.set(data);
        this.showTraceDialog.set(true);
      },
    });
  }

  protected closeTraceDialog(): void {
    this.showTraceDialog.set(false);
    this.traceData.set(null);
  }
}
