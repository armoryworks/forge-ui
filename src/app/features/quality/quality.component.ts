import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal, computed, ViewChild, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';

import { QualityService } from './services/quality.service';
import { QcInspection } from './models/qc-inspection.model';
import { QcTemplate } from './models/qc-template.model';
import { LotRecord } from './models/lot-record.model';
import { SpcCharacteristic } from './models/spc.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../shared/components/entity-picker/entity-picker.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KanbanService } from '../kanban/services/kanban.service';
import { SpcCharacteristicsComponent } from './components/spc-characteristics.component';
import { SpcChartComponent } from './components/spc-chart.component';
import { SpcDataEntryComponent } from './components/spc-data-entry.component';
import { SpcOocListComponent } from './components/spc-ooc-list.component';
import { NcrListComponent } from './components/ncr-list.component';
import { CapaListComponent } from './components/capa-list.component';
import { EcoListComponent } from './components/eco-list.component';
import { GageListComponent } from './components/gage-list.component';
import {
  QcInspectionDetailDialogComponent,
  QcInspectionDetailDialogData,
  QcInspectionDetailDialogResult,
} from './components/qc-inspection-detail-dialog/qc-inspection-detail-dialog.component';
import {
  QcTemplateEditorDialogComponent,
  QcTemplateEditorDialogData,
} from './components/qc-template-editor-dialog/qc-template-editor-dialog.component';

type QualityTab = 'inspections' | 'templates' | 'spc-charts' | 'spc-data' | 'spc-ooc' | 'ncrs' | 'capas' | 'ecos' | 'gages';

const VALID_TABS: QualityTab[] = ['inspections', 'templates', 'spc-charts', 'spc-data', 'spc-ooc', 'ncrs', 'capas', 'ecos', 'gages'];

const NEW_TEMPLATE_OPTION = -1;

const INSPECTION_DETAIL_TYPE = 'qc-inspection';

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, EntityPickerComponent,
    DataTableComponent, ColumnCellDirective,
    ValidationButtonComponent, LoadingBlockDirective,
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
  private readonly kanbanService = inject(KanbanService);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly detailDialog = inject(DetailDialogService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(SpcCharacteristicsComponent) spcCharsComponent?: SpcCharacteristicsComponent;
  @ViewChild(NcrListComponent) ncrListComponent?: NcrListComponent;
  @ViewChild(CapaListComponent) capaListComponent?: CapaListComponent;
  @ViewChild(EcoListComponent) ecoListComponent?: EcoListComponent;
  @ViewChild(GageListComponent) gageListComponent?: GageListComponent;

  private readonly inspectionPartPicker = viewChild<EntityPickerComponent>('inspectionPartPicker');

  private readonly routeTab = toSignal(
    this.route.paramMap.pipe(map(p => p.get('tab'))),
    { initialValue: null },
  );

  protected readonly activeTab = computed<QualityTab>(() => {
    const tab = this.routeTab() as QualityTab;
    return VALID_TABS.includes(tab) ? tab : 'inspections';
  });

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly selectedCharacteristic = signal<SpcCharacteristic | null>(null);

  protected readonly inspections = signal<QcInspection[]>([]);
  protected readonly templates = signal<QcTemplate[]>([]);
  protected readonly showInspectionDialog = signal(false);
  private detailRestored = false;

  protected readonly statusFilterControl = new FormControl<string>(this.route.snapshot.queryParamMap.get('status') ?? '', { nonNullable: true });
  protected readonly inspectionSearchControl = new FormControl<string>(this.route.snapshot.queryParamMap.get('q') ?? '', { nonNullable: true });

  protected readonly inspectionColumns: ColumnDef[] = [
    { field: 'createdAt', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '120px' },
    { field: 'jobNumber', header: this.translate.instant('qcInspections.workOrder'), sortable: true, width: '110px' },
    { field: 'partNumber', header: this.translate.instant('qcInspections.part'), sortable: true, width: '130px' },
    { field: 'templateName', header: this.translate.instant('quality.template'), sortable: true },
    { field: 'inspectorName', header: this.translate.instant('quality.inspector'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('quality.lotNumber'), sortable: true, width: '140px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '110px',
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
    { value: NEW_TEMPLATE_OPTION, label: this.translate.instant('qcInspections.newTemplateOption') },
  ]);

  protected readonly inspectionForm = new FormGroup({
    jobId: new FormControl<number | null>(null),
    partId: new FormControl<number | null>(null),
    templateId: new FormControl<number | null>(null),
    lotNumber: new FormControl('', { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true }),
  });

  protected readonly inspectionViolations = FormValidationService.getViolations(this.inspectionForm, {
    jobId: this.translate.instant('qcInspections.workOrder'),
    partId: this.translate.instant('qcInspections.part'),
    templateId: this.translate.instant('quality.template'),
    lotNumber: this.translate.instant('quality.lotNumber'),
    notes: this.translate.instant('common.notes'),
  });

  private readonly partLots = toSignal(
    this.inspectionForm.controls.partId.valueChanges.pipe(
      distinctUntilChanged(),
      switchMap(partId => partId ? this.qualityService.getLotRecords({ partId }) : of([] as LotRecord[])),
    ),
    { initialValue: [] as LotRecord[] },
  );

  private readonly lotText = toSignal(this.inspectionForm.controls.lotNumber.valueChanges, { initialValue: '' });

  protected readonly lotSuggestions = computed<string[]>(() => {
    const typed = (this.lotText() ?? '').trim().toLowerCase();
    const seen = new Set<string>();
    return this.partLots()
      .map(l => l.lotNumber)
      .filter(lot => {
        const lower = lot.toLowerCase();
        if (seen.has(lot) || lower === typed || (typed && !lower.includes(typed))) return false;
        seen.add(lot);
        return true;
      })
      .slice(0, 8);
  });

  protected readonly templateColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('qcInspections.templateName'), sortable: true },
    { field: 'partNumber', header: this.translate.instant('qcInspections.part'), sortable: true, width: '160px' },
    { field: 'itemCount', header: this.translate.instant('qcInspections.colItems'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'actions', header: '', width: '90px', align: 'center' },
  ];

  protected readonly templateRows = computed(() =>
    this.templates().map(t => ({ ...t, itemCount: t.items.length })));

  constructor() {
    this.scanner.setContext('quality');
    this.loadTemplates();

    effect(() => {
      const scan = this.scanner.lastScan();
      if (!scan || scan.context !== 'quality') return;
      this.scanner.clearLastScan();
      this.inspectionSearchControl.setValue(scan.value);
    });

    effect(() => {
      if (this.routeTab() === 'lots') {
        this.router.navigate(['/lots'], { replaceUrl: true });
        return;
      }
      if (this.activeTab() === 'inspections') this.loadInspections();
      if (this.activeTab() === 'templates') this.loadTemplates();
    });

    this.inspectionSearchControl.valueChanges.pipe(
      debounceTime(300),
      map(v => v.trim()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.applyInspectionFilters());

    this.inspectionForm.controls.templateId.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(value => {
      if (value === NEW_TEMPLATE_OPTION) this.createTemplateFromInspection();
    });
  }

  protected switchTab(tab: QualityTab): void {
    this.router.navigate(['..', tab], { relativeTo: this.route });
  }

  protected openLots(): void {
    this.router.navigate(['/lots']);
  }

  protected onCharacteristicSelected(char: SpcCharacteristic): void {
    this.selectedCharacteristic.set(char);
    this.switchTab('spc-charts');
  }

  protected onMeasurementRecorded(): void {
    this.spcCharsComponent?.loadCharacteristics();
  }

  protected loadInspections(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value || undefined;
    const search = this.inspectionSearchControl.value.trim() || undefined;
    this.qualityService.getInspections({ status, search }).subscribe({
      next: (data) => {
        this.inspections.set(data);
        this.loading.set(false);
        this.restoreDetailFromUrl();
      },
      error: () => this.loading.set(false),
    });
  }

  protected loadTemplates(): void {
    this.qualityService.getTemplates().subscribe({
      next: (data) => this.templates.set(data),
    });
  }

  protected applyInspectionFilters(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.inspectionSearchControl.value.trim() || null,
        status: this.statusFilterControl.value || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadInspections();
  }

  protected openInspection(row: unknown): void {
    this.openInspectionById((row as QcInspection).id);
  }

  protected openCreateInspection(): void {
    this.inspectionForm.reset({ jobId: null, partId: null, templateId: null, lotNumber: '', notes: '' });
    this.showInspectionDialog.set(true);
  }

  protected closeInspectionDialog(): void {
    this.showInspectionDialog.set(false);
  }

  protected onWorkOrderSelected(job: Record<string, unknown> | null): void {
    const jobId = job?.['id'];
    if (typeof jobId !== 'number') return;
    this.kanbanService.getJobDetail(jobId).subscribe({
      next: detail => {
        if (detail.partId == null || this.inspectionForm.controls.jobId.value !== jobId) return;
        this.inspectionForm.controls.partId.setValue(detail.partId);
        this.inspectionPartPicker()?.setSelected(detail.partId, detail.partNumber ?? '');
      },
    });
  }

  protected useLotSuggestion(lot: string): void {
    this.inspectionForm.controls.lotNumber.setValue(lot);
  }

  protected saveInspection(): void {
    if (this.saving()) return;
    this.saving.set(true);
    const form = this.inspectionForm.getRawValue();
    const templateId = form.templateId && form.templateId !== NEW_TEMPLATE_OPTION ? form.templateId : undefined;
    this.qualityService.createInspection({
      jobId: form.jobId ?? undefined,
      partId: form.partId ?? undefined,
      templateId,
      lotNumber: form.lotNumber.trim() || undefined,
      notes: form.notes.trim() || undefined,
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

  protected openTemplateEditor(template: QcTemplate | null): void {
    this.dialog.open<QcTemplateEditorDialogComponent, QcTemplateEditorDialogData, QcTemplate | undefined>(
      QcTemplateEditorDialogComponent,
      { width: '800px', maxWidth: '95vw', data: { template } },
    ).afterClosed().subscribe(saved => {
      if (saved) this.loadTemplates();
    });
  }

  protected editTemplate(row: unknown): void {
    const id = (row as QcTemplate).id;
    this.openTemplateEditor(this.templates().find(t => t.id === id) ?? null);
  }

  protected deleteTemplate(row: QcTemplate): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('qcInspections.deleteTemplateTitle'),
        message: this.translate.instant('qcInspections.deleteTemplateMessage', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.qualityService.deleteTemplate(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('qcInspections.templateDeleted'));
          this.loadTemplates();
        },
      });
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
    const keys: Record<string, string> = {
      InProgress: 'quality.statusInProgress',
      Passed: 'quality.statusPassed',
      Failed: 'quality.statusFailed',
    };
    return keys[status] ? this.translate.instant(keys[status]) : status;
  }

  protected getResultsSummary(inspection: QcInspection): string {
    if (!inspection.results || inspection.results.length === 0) return '—';
    const passed = inspection.results.filter(r => r.passed).length;
    return `${passed}/${inspection.results.length}`;
  }

  private createTemplateFromInspection(): void {
    const control = this.inspectionForm.controls.templateId;
    this.dialog.open<QcTemplateEditorDialogComponent, QcTemplateEditorDialogData, QcTemplate | undefined>(
      QcTemplateEditorDialogComponent,
      { width: '800px', maxWidth: '95vw', data: { template: null } },
    ).afterClosed().subscribe(saved => {
      if (!saved) {
        control.setValue(null, { emitEvent: false });
        return;
      }
      this.templates.update(list => [...list.filter(t => t.id !== saved.id), saved]);
      control.setValue(saved.id, { emitEvent: false });
      this.loadTemplates();
    });
  }

  private restoreDetailFromUrl(): void {
    if (this.detailRestored) return;
    this.detailRestored = true;
    const detail = this.detailDialog.getDetailFromUrl();
    if (detail?.entityType === INSPECTION_DETAIL_TYPE) this.openInspectionById(detail.entityId);
  }

  private openInspectionById(id: number): void {
    this.detailDialog.open<QcInspectionDetailDialogComponent, QcInspectionDetailDialogData, QcInspectionDetailDialogResult>(
      INSPECTION_DETAIL_TYPE, id, QcInspectionDetailDialogComponent, { inspectionId: id }, { width: '960px' },
    ).afterClosed().subscribe(result => {
      if (result?.changed) this.loadInspections();
      if (result?.openNcrId != null) {
        this.router.navigate(['/quality', 'ncrs'], { queryParams: { detail: `ncr:${result.openNcrId}` } });
      }
    });
  }
}
