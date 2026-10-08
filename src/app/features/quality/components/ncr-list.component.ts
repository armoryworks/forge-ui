import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NcrCapaService } from '../services/ncr-capa.service';
import { NonConformance } from '../models/non-conformance.model';
import { NcrType } from '../models/ncr-type.model';
import { NcrStatus } from '../models/ncr-status.model';
import { NcrDetectionStage } from '../models/ncr-detection-stage.model';
import { NcrDispositionCode } from '../models/ncr-disposition-code.model';
import { NcrDetailPanelComponent } from './ncr-detail-panel/ncr-detail-panel.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { DetailSidePanelComponent } from '../../../shared/components/detail-side-panel/detail-side-panel.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';

const NOTES_REQUIRED_CODES: readonly NcrDispositionCode[] = ['UseAsIs', 'Reject'];

const requiredText = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Component({
  selector: 'app-ncr-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe,
    DataTableComponent, ColumnCellDirective,
    SelectComponent, InputComponent, TextareaComponent, EntityPickerComponent,
    DialogComponent, DetailSidePanelComponent, LoadingBlockDirective,
    ValidationButtonComponent, NcrDetailPanelComponent,
  ],
  templateUrl: './ncr-list.component.html',
  styleUrl: './ncr-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NcrListComponent implements OnInit {
  private readonly ncrCapaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly ncrs = signal<NonConformance[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly showDispositionDialog = signal(false);
  protected readonly dispositionNcr = signal<NonConformance | null>(null);
  protected readonly selectedNcr = signal<NonConformance | null>(null);
  protected readonly detailRefresh = signal(0);

  protected readonly typeFilter = new FormControl<NcrType | ''>('');
  protected readonly statusFilter = new FormControl<NcrStatus | ''>('');

  protected readonly typeOptions: SelectOption[] = [
    { value: 'Internal', label: this.translate.instant('ncrDetail.types.Internal') },
    { value: 'Supplier', label: this.translate.instant('ncrDetail.types.Supplier') },
    { value: 'Customer', label: this.translate.instant('ncrDetail.types.Customer') },
  ];

  protected readonly typeFilterOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('ncrDetail.allTypes') },
    ...this.typeOptions,
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'Open', label: this.translate.instant('ncrDetail.statuses.Open') },
    { value: 'UnderReview', label: this.translate.instant('ncrDetail.statuses.UnderReview') },
    { value: 'Contained', label: this.translate.instant('ncrDetail.statuses.Contained') },
    { value: 'Dispositioned', label: this.translate.instant('ncrDetail.statuses.Dispositioned') },
    { value: 'Closed', label: this.translate.instant('ncrDetail.statuses.Closed') },
  ];

  protected readonly statusFilterOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('ncrDetail.allStatuses') },
    ...this.statusOptions,
  ];

  protected readonly detectionStageOptions: SelectOption[] = [
    { value: 'Receiving', label: this.translate.instant('ncrDetail.stages.Receiving') },
    { value: 'InProcess', label: this.translate.instant('ncrDetail.stages.InProcess') },
    { value: 'FinalInspection', label: this.translate.instant('ncrDetail.stages.FinalInspection') },
    { value: 'Shipping', label: this.translate.instant('ncrDetail.stages.Shipping') },
    { value: 'Customer', label: this.translate.instant('ncrDetail.stages.Customer') },
    { value: 'Audit', label: this.translate.instant('ncrDetail.stages.Audit') },
  ];

  protected readonly dispositionCodeOptions: SelectOption[] = [
    { value: 'UseAsIs', label: this.translate.instant('ncrDetail.dispositionCodes.UseAsIs') },
    { value: 'Rework', label: this.translate.instant('ncrDetail.dispositionCodes.Rework') },
    { value: 'Scrap', label: this.translate.instant('ncrDetail.dispositionCodes.Scrap') },
    { value: 'ReturnToVendor', label: this.translate.instant('ncrDetail.dispositionCodes.ReturnToVendor') },
    { value: 'SortAndScreen', label: this.translate.instant('ncrDetail.dispositionCodes.SortAndScreen') },
    { value: 'Reject', label: this.translate.instant('ncrDetail.dispositionCodes.Reject') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'ncrNumber', header: this.translate.instant('ncrDetail.ncrNumber'), sortable: true, width: '140px' },
    { field: 'type', header: this.translate.instant('ncrDetail.type'), sortable: true, filterable: true, type: 'enum', filterOptions: this.typeOptions, width: '90px' },
    { field: 'partNumber', header: this.translate.instant('ncrDetail.part'), sortable: true, width: '120px' },
    { field: 'detectedAtStage', header: this.translate.instant('ncrDetail.stage'), sortable: true, width: '120px' },
    { field: 'description', header: this.translate.instant('ncrDetail.description'), sortable: true },
    { field: 'affectedQuantity', header: this.translate.instant('ncrDetail.quantity'), sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'status', header: this.translate.instant('ncrDetail.status'), sortable: true, filterable: true, type: 'enum', filterOptions: this.statusOptions, width: '120px' },
    { field: 'detectedAt', header: this.translate.instant('ncrDetail.detected'), sortable: true, type: 'date', width: '100px' },
    { field: 'actions', header: '', width: '80px' },
  ];

  protected readonly createForm = new FormGroup({
    type: new FormControl<NcrType>('Internal', { nonNullable: true }),
    partId: new FormControl<number | null>(null, [Validators.required]),
    jobId: new FormControl<number | null>(null),
    lotNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    detectedAtStage: new FormControl<NcrDetectionStage>('Receiving', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    affectedQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    defectiveQuantity: new FormControl<number | null>(null),
    containmentActions: new FormControl(''),
  });

  protected readonly dispositionForm = new FormGroup({
    code: new FormControl<NcrDispositionCode>('UseAsIs', { nonNullable: true }),
    notes: new FormControl(''),
    reworkInstructions: new FormControl(''),
  });

  protected readonly dispositionCode = toSignal(this.dispositionForm.controls.code.valueChanges, {
    initialValue: this.dispositionForm.controls.code.value,
  });
  protected readonly notesRequired = computed(() => NOTES_REQUIRED_CODES.includes(this.dispositionCode()));

  protected readonly dispositionViolations = FormValidationService.getViolations(this.dispositionForm, {
    notes: this.translate.instant('ncrDetail.notes'),
    reworkInstructions: this.translate.instant('ncrDetail.reworkInstructions'),
  });

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    partId: this.translate.instant('ncrDetail.part'),
    lotNumber: this.translate.instant('ncrDetail.lotNumber'),
    description: this.translate.instant('ncrDetail.description'),
    affectedQuantity: this.translate.instant('ncrDetail.affectedQuantity'),
  });

  constructor() {
    this.dispositionForm.controls.code.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(code => this.applyDispositionValidators(code));
    this.applyDispositionValidators(this.dispositionForm.controls.code.value);
  }

  ngOnInit(): void {
    this.loadNcrs();
  }

  loadNcrs(): void {
    this.loading.set(true);
    const type = this.typeFilter.value || undefined;
    const status = this.statusFilter.value || undefined;
    this.ncrCapaService.getNcrs({ type: type as NcrType, status: status as NcrStatus }).subscribe({
      next: ncrs => {
        this.ncrs.set(ncrs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.createForm.reset({ type: 'Internal', detectedAtStage: 'Receiving' });
    this.showCreateDialog.set(true);
  }

  saveNcr(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    const value = this.createForm.getRawValue();
    this.ncrCapaService.createNcr({
      ...value,
      lotNumber: value.lotNumber.trim() || null,
    } as Partial<NonConformance>).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('ncrDetail.created'));
        this.showCreateDialog.set(false);
        this.saving.set(false);
        this.loadNcrs();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openDetail(row: unknown): void {
    this.selectedNcr.set(row as NonConformance);
  }

  protected closeDetail(): void {
    this.selectedNcr.set(null);
  }

  openDisposition(ncr: NonConformance): void {
    this.dispositionNcr.set(ncr);
    this.dispositionForm.reset({ code: 'UseAsIs' });
    this.showDispositionDialog.set(true);
  }

  saveDisposition(): void {
    const ncr = this.dispositionNcr();
    if (!ncr || this.dispositionForm.invalid) return;
    this.saving.set(true);
    const formVal = this.dispositionForm.getRawValue();
    this.ncrCapaService.dispositionNcr(ncr.id, {
      code: formVal.code,
      notes: formVal.notes ?? undefined,
      reworkInstructions: formVal.reworkInstructions ?? undefined,
    }).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('ncrDetail.dispositionRecorded'));
        this.showDispositionDialog.set(false);
        this.saving.set(false);
        this.loadNcrs();
        this.detailRefresh.update(n => n + 1);
      },
      error: () => this.saving.set(false),
    });
  }

  private applyDispositionValidators(code: NcrDispositionCode): void {
    const { notes, reworkInstructions } = this.dispositionForm.controls;
    notes.setValidators(NOTES_REQUIRED_CODES.includes(code) ? requiredText : null);
    reworkInstructions.setValidators(code === 'Rework' ? requiredText : null);
    notes.updateValueAndValidity();
    reworkInstructions.updateValueAndValidity();
  }

  createCapa(ncr: NonConformance): void {
    this.ncrCapaService.createCapaFromNcr(ncr.id, ncr.detectedById).subscribe({
      next: capa => {
        this.snackbar.success(this.translate.instant('ncrDetail.capaCreated', { number: capa.capaNumber }));
        this.loadNcrs();
      },
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Open': return 'chip chip--error';
      case 'UnderReview': return 'chip chip--warning';
      case 'Contained': return 'chip chip--info';
      case 'Dispositioned': return 'chip chip--primary';
      case 'Closed': return 'chip chip--muted';
      default: return 'chip';
    }
  }
}
