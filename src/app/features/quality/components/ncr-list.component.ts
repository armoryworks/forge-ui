import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { NcrCapaService } from '../services/ncr-capa.service';
import { NonConformance } from '../models/non-conformance.model';
import { NcrType } from '../models/ncr-type.model';
import { NcrStatus } from '../models/ncr-status.model';
import { NcrDispositionCode } from '../models/ncr-disposition-code.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';

@Component({
  selector: 'app-ncr-list',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule,
    DataTableComponent, ColumnCellDirective,
    SelectComponent, InputComponent, TextareaComponent,
    DialogComponent, LoadingBlockDirective,
    ValidationPopoverDirective,
  ],
  templateUrl: './ncr-list.component.html',
  styleUrl: './ncr-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NcrListComponent implements OnInit {
  private readonly ncrCapaService = inject(NcrCapaService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly ncrs = signal<NonConformance[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly showDispositionDialog = signal(false);
  protected readonly dispositionNcr = signal<NonConformance | null>(null);

  protected readonly typeFilter = new FormControl<NcrType | ''>('');
  protected readonly statusFilter = new FormControl<NcrStatus | ''>('');

  protected readonly typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'Internal', label: 'Internal' },
    { value: 'Supplier', label: 'Supplier' },
    { value: 'Customer', label: 'Customer' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    { value: 'Open', label: 'Open' },
    { value: 'UnderReview', label: 'Under Review' },
    { value: 'Contained', label: 'Contained' },
    { value: 'Dispositioned', label: 'Dispositioned' },
    { value: 'Closed', label: 'Closed' },
  ];

  protected readonly detectionStageOptions: SelectOption[] = [
    { value: 'Receiving', label: 'Receiving' },
    { value: 'InProcess', label: 'In Process' },
    { value: 'FinalInspection', label: 'Final Inspection' },
    { value: 'Shipping', label: 'Shipping' },
    { value: 'Customer', label: 'Customer' },
    { value: 'Audit', label: 'Audit' },
  ];

  protected readonly dispositionCodeOptions: SelectOption[] = [
    { value: 'UseAsIs', label: 'Use As Is' },
    { value: 'Rework', label: 'Rework' },
    { value: 'Scrap', label: 'Scrap' },
    { value: 'ReturnToVendor', label: 'Return to Vendor' },
    { value: 'SortAndScreen', label: 'Sort & Screen' },
    { value: 'Reject', label: 'Reject' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'ncrNumber', header: 'NCR #', sortable: true, width: '140px' },
    { field: 'type', header: 'Type', sortable: true, filterable: true, type: 'enum', filterOptions: this.typeOptions.slice(1), width: '90px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '120px' },
    { field: 'detectedAtStage', header: 'Stage', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'affectedQuantity', header: 'Qty', sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: this.statusOptions.slice(1), width: '120px' },
    { field: 'detectedAt', header: 'Detected', sortable: true, type: 'date', width: '100px' },
    { field: 'actions', header: '', width: '80px' },
  ];

  protected readonly createForm = new FormGroup({
    type: new FormControl<NcrType>('Internal', { nonNullable: true }),
    partId: new FormControl<number | null>(null, [Validators.required]),
    jobId: new FormControl<number | null>(null),
    detectedAtStage: new FormControl('Receiving', { nonNullable: true }),
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

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    partId: 'Part ID',
    description: 'Description',
    affectedQuantity: 'Affected Quantity',
  });

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
    this.ncrCapaService.createNcr(this.createForm.getRawValue() as Partial<NonConformance>).subscribe({
      next: () => {
        this.snackbar.success('NCR created');
        this.showCreateDialog.set(false);
        this.saving.set(false);
        this.loadNcrs();
      },
      error: () => this.saving.set(false),
    });
  }

  openDisposition(ncr: NonConformance): void {
    this.dispositionNcr.set(ncr);
    this.dispositionForm.reset({ code: 'UseAsIs' });
    this.showDispositionDialog.set(true);
  }

  saveDisposition(): void {
    const ncr = this.dispositionNcr();
    if (!ncr) return;
    this.saving.set(true);
    const formVal = this.dispositionForm.getRawValue();
    this.ncrCapaService.dispositionNcr(ncr.id, {
      code: formVal.code,
      notes: formVal.notes ?? undefined,
      reworkInstructions: formVal.reworkInstructions ?? undefined,
    }).subscribe({
      next: () => {
        this.snackbar.success('Disposition recorded');
        this.showDispositionDialog.set(false);
        this.saving.set(false);
        this.loadNcrs();
      },
      error: () => this.saving.set(false),
    });
  }

  createCapa(ncr: NonConformance): void {
    this.ncrCapaService.createCapaFromNcr(ncr.id, ncr.detectedById).subscribe({
      next: capa => {
        this.snackbar.success(`CAPA ${capa.capaNumber} created`);
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
