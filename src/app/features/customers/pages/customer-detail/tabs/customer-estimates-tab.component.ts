import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EstimateService } from '../../../services/estimate.service';
import { QuoteService } from '../../../../quotes/services/quote.service';
import { Estimate, EstimateDetail, EstimateLine, EstimateStatus } from '../../../models/estimate.model';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { CurrencyInputComponent } from '../../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../../shared/components/currency-display/currency-display.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
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
    DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe, MatTooltipModule,
    DataTableComponent, ColumnCellDirective,
    InputComponent, CurrencyInputComponent, CurrencyDisplayComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DialogComponent, ValidationButtonComponent, EntityPickerComponent,
  ],
  templateUrl: './customer-estimates-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerEstimatesTabComponent implements OnInit {
  private readonly estimateService = inject(EstimateService);
  private readonly quoteService = inject(QuoteService);
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
    { field: 'title', header: this.translate.instant('customers.estimates.title'), sortable: true },
    { field: 'estimatedAmount', header: this.translate.instant('customers.estimates.estimatedAmount'),
      sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'status', header: this.translate.instant('common.status'),
      sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: STATUS_OPTIONS },
    { field: 'validUntil', header: this.translate.instant('customers.estimates.validUntil'),
      sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('customers.colCreated'),
      sortable: true, type: 'date', width: '100px' },
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

  // --- Estimate line items (itemize an existing estimate: catalog parts +/or
  // lump-sum "unknown" lines). Lines are managed on a SAVED estimate; a brand-new
  // estimate is created header-first, then itemized on reopen. ---
  protected readonly editingDetail = signal<EstimateDetail | null>(null);
  protected readonly estimateLines = signal<EstimateLine[]>([]);
  // editingLineId: null = line editor closed, 0 = adding, >0 = editing that line.
  protected readonly editingLineId = signal<number | null>(null);
  protected readonly savingLine = signal(false);
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.0001)] }),
    unitPrice: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
  });

  /** True while the unit price reflects the resolved customer/list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);

  constructor() {
    // Manual price edit clears the "LIST" badge (mirrors quote-dialog).
    // Programmatic pre-fills use emitEvent: false so they don't trip this.
    this.lineForm.controls.unitPrice.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.priceIsDefault.set(false));
  }

  // Lines are editable only on a saved, Draft, not-yet-converted estimate.
  protected readonly canEditLines = computed(() => {
    const d = this.editingDetail();
    return !!d && d.status === 'Draft' && !d.convertedAt;
  });

  // The open estimate, when it can still be converted to a quote (mirrors the
  // row-level convert button's !generatedQuoteId condition). Null hides the
  // dialog-footer convert button.
  protected readonly convertibleDetail = computed(() => {
    const d = this.editingDetail();
    return d && !d.generatedQuoteId ? d : null;
  });

  protected readonly violations = computed(() =>
    FormValidationService.getViolations(this.estimateForm, {
      title: this.translate.instant('customers.estimates.title'),
      estimatedAmount: this.translate.instant('customers.estimates.estimatedAmount'),
    })
  );

  protected readonly dialogTitle = computed(() =>
    this.translate.instant(this.editingId() ? 'customers.estimates.editEstimate' : 'customers.estimates.newEstimate')
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
    this.resetLineState();
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
    this.resetLineState();
    this.showDialog.set(true);
    // Fetch full detail for the line grid (the list row carries no lines).
    this.estimateService.getEstimate(estimate.id).subscribe({
      next: detail => {
        this.editingDetail.set(detail);
        this.estimateLines.set(detail.lines ?? []);
        this.estimateForm.patchValue({ description: detail.description ?? '', notes: detail.notes ?? '' });
      },
    });
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.estimateForm.reset();
    this.editingId.set(null);
    this.resetLineState();
  }

  private resetLineState(): void {
    this.editingDetail.set(null);
    this.estimateLines.set([]);
    this.editingLineId.set(null);
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
          this.snackbar.success(this.translate.instant('customers.estimates.estimateUpdated'));
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
        next: created => {
          this.saving.set(false);
          // Don't close: transition the dialog in place to edit mode so line
          // items can be added immediately (no save → reopen round-trip).
          this.editingId.set(created.id);
          this.estimateService.getEstimate(created.id).subscribe({
            next: detail => {
              this.editingDetail.set(detail);
              this.estimateLines.set(detail.lines ?? []);
              this.estimateForm.patchValue({ description: detail.description ?? '', notes: detail.notes ?? '' });
            },
          });
          // Refresh the list behind the dialog in the background.
          this.loadEstimates();
          this.snackbar.success(this.translate.instant('customers.estimates.estimateCreatedAddLines'));
        },
        error: () => this.saving.set(false),
      });
    }
  }

  protected deleteEstimate(estimate: Estimate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.estimates.deleteTitle'),
        message: this.translate.instant('customers.estimates.deleteMessage', { title: estimate.title }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.estimateService.deleteEstimate(estimate.id).subscribe({
        next: () => {
          this.loadEstimates();
          this.snackbar.success(this.translate.instant('customers.estimates.estimateDeleted'));
        },
      });
    });
  }

  // --- Estimate line editing ---
  protected startAddLine(): void {
    this.lineForm.reset({ partId: null, description: '', quantity: 1, unitPrice: 0 });
    this.editingLineId.set(0);
  }

  protected editLine(line: EstimateLine): void {
    this.lineForm.reset({
      partId: line.partId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    });
    this.editingLineId.set(line.id);
  }

  protected cancelLineEdit(): void {
    this.editingLineId.set(null);
  }

  /**
   * Prefill the description from the chosen catalog part when blank, and pull
   * the customer's resolved price-list unit price (same resolver the quote
   * dialog uses). The price stays editable — estimates support lump-sum lines —
   * and a manual edit clears the "LIST" badge via the valueChanges sub above.
   */
  protected onPartSelected(part: Record<string, unknown> | null): void {
    this.priceIsDefault.set(false);
    if (!part) return;
    const name = (part['name'] as string) ?? '';
    if (name && !this.lineForm.controls.description.value) {
      this.lineForm.controls.description.setValue(name);
    }
    const partId = part['id'] as number | undefined;
    if (!partId) return;
    this.quoteService.resolvePrice(this.customerId(), partId).subscribe({
      next: price => {
        if (price != null && price > 0) {
          this.lineForm.controls.unitPrice.setValue(price, { emitEvent: false });
          this.priceIsDefault.set(true);
        }
      },
    });
  }

  protected saveLine(): void {
    const id = this.editingId();
    const editing = this.editingLineId();
    if (!id || editing === null || this.lineForm.invalid) return;
    const v = this.lineForm.getRawValue();
    this.savingLine.set(true);
    // No part chosen → a lump-sum / ad-hoc "unknown" line (partId omitted).
    const req = editing === 0
      ? this.estimateService.addEstimateLine(id, {
          partId: v.partId ?? undefined,
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        })
      : this.estimateService.updateEstimateLine(id, editing, {
          description: v.description,
          quantity: v.quantity,
          unitPrice: v.unitPrice,
        });
    req.subscribe({
      next: detail => {
        this.applyDetail(detail);
        this.editingLineId.set(null);
        this.savingLine.set(false);
        this.snackbar.success(this.translate.instant(editing === 0 ? 'customers.estimates.lineAdded' : 'customers.estimates.lineUpdated'));
      },
      error: () => this.savingLine.set(false),
    });
  }

  protected deleteLine(line: EstimateLine): void {
    const id = this.editingId();
    if (!id) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('customers.estimates.deleteLineTitle'),
        message: this.translate.instant('customers.estimates.deleteLineMessage', { description: line.description }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.estimateService.deleteEstimateLine(id, line.id).subscribe({
        next: detail => {
          this.applyDetail(detail);
          this.snackbar.success(this.translate.instant('customers.estimates.lineRemoved'));
        },
      });
    });
  }

  /** Reflect a server-refreshed detail: lines + the synced estimated amount, and the list row. */
  private applyDetail(detail: EstimateDetail): void {
    this.editingDetail.set(detail);
    this.estimateLines.set(detail.lines ?? []);
    this.estimateForm.patchValue({ estimatedAmount: detail.estimatedAmount });
    this.loadEstimates();
  }

  protected convertToQuote(estimate: Estimate): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('customers.estimates.convertTitle'),
        message: this.translate.instant('customers.estimates.convertMessage', { title: estimate.title }),
        confirmLabel: this.translate.instant('customers.estimates.convertConfirmLabel'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.estimateService.convertToQuote(estimate.id).subscribe({
        next: result => {
          this.snackbar.success(this.translate.instant('customers.estimates.createdQuote', { number: result.quoteNumber ?? '' }));
          if (this.editingId() === estimate.id) {
            // Converted from the edit dialog: refresh the open detail in place
            // (hides the footer convert button, locks lines) + reload the list.
            this.estimateService.getEstimate(estimate.id).subscribe({
              next: detail => this.applyDetail(detail),
            });
          } else {
            this.loadEstimates();
          }
        },
      });
    });
  }
}
