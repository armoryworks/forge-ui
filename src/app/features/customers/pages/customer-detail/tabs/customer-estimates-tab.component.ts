import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { EstimateService } from '../../../services/estimate.service';
import { Estimate, EstimateStatus } from '../../../models/estimate.model';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { ValidationPopoverDirective } from '../../../../../shared/directives/validation-popover.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';
import { SelectOption } from '../../../../../shared/components/select/select.component';
import { toIsoDate } from '../../../../../shared/utils/date.utils';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Sent', label: 'Sent' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Declined', label: 'Declined' },
  { value: 'Expired', label: 'Expired' },
];

@Component({
  selector: 'app-customer-estimates-tab',
  standalone: true,
  imports: [
    CurrencyPipe, DatePipe, ReactiveFormsModule,
    DataTableComponent, ColumnCellDirective,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DialogComponent, ValidationPopoverDirective,
  ],
  templateUrl: './customer-estimates-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerEstimatesTabComponent implements OnInit {
  private readonly estimateService = inject(EstimateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();

  protected readonly estimates = signal<Estimate[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly statusOptions = STATUS_OPTIONS;

  protected readonly columns: ColumnDef[] = [
    { field: 'title', header: 'Title', sortable: true },
    { field: 'estimatedAmount', header: 'Amount', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: STATUS_OPTIONS },
    { field: 'validUntil', header: 'Valid Until', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '100px' },
    { field: 'actions', header: '', width: '100px' },
  ];

  protected readonly estimateForm = new FormGroup({
    title: new FormControl('', [Validators.required, Validators.maxLength(300)]),
    description: new FormControl(''),
    estimatedAmount: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    validUntil: new FormControl<Date | null>(null),
    notes: new FormControl(''),
    status: new FormControl<EstimateStatus>('Draft'),
  });

  protected readonly violations = computed(() =>
    FormValidationService.getViolations(this.estimateForm, {
      title: 'Title',
      estimatedAmount: 'Estimated Amount',
    })
  );

  protected readonly dialogTitle = computed(() =>
    this.editingId() ? 'Edit Estimate' : 'New Estimate'
  );

  protected readonly isEditing = computed(() => this.editingId() !== null);

  ngOnInit(): void {
    this.loadEstimates();
  }

  protected loadEstimates(): void {
    this.loading.set(true);
    this.estimateService.getEstimates(this.customerId()).subscribe({
      next: data => { this.estimates.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getStatusClass(status: EstimateStatus): string {
    const map: Record<EstimateStatus, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      Accepted: 'chip--success',
      Declined: 'chip--error',
      Expired: 'chip--warning',
      ConvertedToQuote: 'chip--primary',
    };
    return map[status] ?? 'chip--muted';
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.estimateForm.reset({ estimatedAmount: 0, status: 'Draft' });
    this.showDialog.set(true);
  }

  protected openEdit(estimate: Estimate): void {
    this.editingId.set(estimate.id);
    this.estimateForm.patchValue({
      title: estimate.title,
      estimatedAmount: estimate.estimatedAmount,
      status: estimate.status,
      validUntil: estimate.validUntil ? new Date(estimate.validUntil) : null,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.estimateForm.reset();
    this.editingId.set(null);
  }

  protected saveEstimate(): void {
    if (this.estimateForm.invalid || this.saving()) return;
    const v = this.estimateForm.value;
    this.saving.set(true);
    const id = this.editingId();

    if (id) {
      this.estimateService.updateEstimate(id, {
        title: v.title ?? undefined,
        estimatedAmount: v.estimatedAmount ?? undefined,
        status: v.status ?? undefined,
        validUntil: v.validUntil ? toIsoDate(v.validUntil) ?? undefined : undefined,
        notes: v.notes ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeDialog();
          this.loadEstimates();
          this.snackbar.success('Estimate updated');
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.estimateService.createEstimate({
        customerId: this.customerId(),
        title: v.title!,
        description: v.description ?? undefined,
        estimatedAmount: v.estimatedAmount!,
        validUntil: v.validUntil ? toIsoDate(v.validUntil) ?? undefined : undefined,
        notes: v.notes ?? undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeDialog();
          this.loadEstimates();
          this.snackbar.success('Estimate created');
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected deleteEstimate(estimate: Estimate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Estimate?',
        message: `Delete "${estimate.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.estimateService.deleteEstimate(estimate.id).subscribe({
        next: () => {
          this.loadEstimates();
          this.snackbar.success('Estimate deleted');
        },
      });
    });
  }

  protected convertToQuote(estimate: Estimate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: 'Convert to Quote?',
        message: `Convert "${estimate.title}" to a formal quote? The estimate will be marked as Accepted.`,
        confirmLabel: 'Convert',
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.estimateService.convertToQuote(estimate.id).subscribe({
        next: result => {
          this.loadEstimates();
          this.snackbar.success(`Created quote ${result.quoteNumber ?? ''}`);
        },
      });
    });
  }
}
