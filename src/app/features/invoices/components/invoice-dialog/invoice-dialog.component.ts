import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, output, computed, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerListItem } from '../../../customers/models/customer-list-item.model';
import { CreateInvoiceLineRequest } from '../../models/create-invoice-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ActiveCurrencyService } from '../../../../shared/services/active-currency.service';
import { ActiveCurrency } from '../../../../shared/models/active-currency.model';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';

interface LineEntry {
  partId: number | null;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// ---- ACCOUNTING BOUNDARY ----

@Component({
  selector: 'app-invoice-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    CurrencyDisplayComponent, ValidationButtonComponent, MatTooltipModule,
  ],
  templateUrl: './invoice-dialog.component.html',
  styleUrl: './invoice-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly currencyService = inject(ActiveCurrencyService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly closed = output<void>();
  readonly saved = output<void>();

  /**
   * Optional pre-link: when the dialog is opened from a sales-order context
   * (e.g. the SO Invoices tab) the customer and SO are fixed — the customer
   * select is disabled to prevent a mismatched invoice.
   */
  readonly initialCustomerId = input<number | null>(null);
  readonly initialSalesOrderId = input<number | null>(null);

  protected readonly saving = signal(false);
  protected readonly customers = signal<CustomerListItem[]>([]);
  /** Phase 1l — invoice issue date is when it was issued; not future. */
  protected readonly today = todayEnd();
  protected readonly lines = signal<LineEntry[]>([]);

  protected readonly customerOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('invoices.selectCustomer') },
    ...this.customers().map(c => ({ value: c.id, label: c.name })),
  ]);

  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;

  // ── Multi-currency (additive) ──────────────────────────────────────────────
  // Hidden entirely for single-currency installs: the currency selector only
  // renders when >1 active currency exists, and the FX-rate input only renders
  // when a non-base currency is selected (base ⇒ rate is 1, hidden).
  protected readonly currencies = signal<ActiveCurrency[]>([]);
  protected readonly baseCurrencyId = computed<number | null>(
    () => this.currencies().find(c => c.isBaseCurrency)?.id ?? this.currencies()[0]?.id ?? null,
  );
  protected readonly showCurrencySelector = computed(() => this.currencies().length > 1);
  protected readonly currencyOptions = computed<SelectOption[]>(() =>
    this.currencies().map(c => ({ value: c.id, label: `${c.code} — ${c.name}` })),
  );

  protected readonly invoiceForm = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    salesOrderId: new FormControl<number | null>(null),
    shipmentId: new FormControl<number | null>(null),
    invoiceDate: new FormControl<Date | null>(null, [Validators.required]),
    dueDate: new FormControl<Date | null>(null, [Validators.required]),
    creditTerms: new FormControl<string | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number>(1, [Validators.required, Validators.min(0.0000001)]),
    notes: new FormControl(''),
  });

  private readonly selectedCurrencyId = toSignal(
    this.invoiceForm.controls.currencyId.valueChanges.pipe(
      startWith(this.invoiceForm.controls.currencyId.value),
    ),
    { initialValue: this.invoiceForm.controls.currencyId.value },
  );
  /** FX rate is only relevant (and shown) when a non-base currency is chosen. */
  protected readonly showFxRate = computed(() => {
    const base = this.baseCurrencyId();
    const selected = this.selectedCurrencyId();
    return base !== null && selected !== null && selected !== base;
  });

  protected readonly violations = FormValidationService.getViolations(this.invoiceForm, {
    customerId: this.translate.instant('invoices.customer'),
    salesOrderId: this.translate.instant('invoices.salesOrderId'),
    shipmentId: this.translate.instant('invoices.shipmentId'),
    invoiceDate: this.translate.instant('invoices.invoiceDate'),
    dueDate: this.translate.instant('invoices.dueDate'),
    creditTerms: this.translate.instant('invoices.creditTerms'),
    taxRate: this.translate.instant('invoices.taxRate'),
    currencyId: this.translate.instant('accounting.currency.currency'),
    fxRate: this.translate.instant('accounting.currency.fxRate'),
    notes: this.translate.instant('common.notes'),
  });

  // Line item form
  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null),
    partNumber: new FormControl(''),
    description: new FormControl('', [Validators.required]),
    // Phase 3 / WU-23 (F8-broad): fractional UoM-aware quantities accepted.
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  protected readonly taxRateValue = toSignal(
    this.invoiceForm.controls.taxRate.valueChanges.pipe(startWith(this.invoiceForm.controls.taxRate.value ?? 0)),
    { initialValue: this.invoiceForm.controls.taxRate.value ?? 0 }
  );
  protected readonly taxAmount = computed(() => (this.taxRateValue() ?? 0) / 100 * this.lineTotal());
  protected readonly grandTotal = computed(() => this.lineTotal() + this.taxAmount());

  protected readonly draftConfig: DraftConfig = {
    entityType: 'invoice',
    entityId: 'new',
    route: '/invoices',
    snapshotFn: () => ({ ...this.invoiceForm.getRawValue(), lines: this.lines() }),
    restoreFn: (data) => {
      this.invoiceForm.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.invoiceForm.markAsDirty();
    },
  };

  constructor() {
    this.customerService.getCustomers(undefined, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.customers.set(list),
    });

    // Apply the SO-context pre-link once inputs resolve. save() reads
    // getRawValue(), so the disabled customer control still submits.
    effect(() => {
      const customerId = this.initialCustomerId();
      const salesOrderId = this.initialSalesOrderId();
      if (customerId != null && this.invoiceForm.controls.customerId.value === null) {
        this.invoiceForm.controls.customerId.setValue(customerId);
        this.invoiceForm.controls.customerId.disable();
      }
      if (salesOrderId != null && this.invoiceForm.controls.salesOrderId.value === null) {
        this.invoiceForm.controls.salesOrderId.setValue(salesOrderId);
      }
    });

    // Load active currencies; default the form to the base currency. The
    // selector only renders when >1 active currency exists, so single-currency
    // installs see no visual change.
    this.currencyService.listActiveCurrencies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        this.currencies.set(list);
        const base = this.baseCurrencyId();
        if (base !== null && this.invoiceForm.controls.currencyId.value === null) {
          this.invoiceForm.controls.currencyId.setValue(base);
        }
      },
    });

    // Returning to the base currency resets the booking rate to 1.
    this.invoiceForm.controls.currencyId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (id === this.baseCurrencyId()) {
          this.invoiceForm.controls.fxRate.setValue(1);
        }
      });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    this.lines.update(prev => [...prev, {
      partId: f.partId ?? null,
      partNumber: f.partNumber ?? '',
      description: f.description ?? '',
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, partNumber: '', description: '', quantity: 1, unitPrice: 0 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.invoiceForm.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.invoiceForm.getRawValue();
    const lineRequests: CreateInvoiceLineRequest[] = this.lines().map(l => ({
      partId: l.partId ?? undefined,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    // Only attach currency when the install is multi-currency; otherwise let
    // the server resolve the functional currency (keeps single-currency callers
    // byte-for-byte unchanged). FX rate defaults to 1 for the base currency.
    const isBase = f.currencyId === this.baseCurrencyId();
    const currencyId = this.showCurrencySelector() ? (f.currencyId ?? undefined) : undefined;
    const fxRate = isBase ? 1 : (f.fxRate ?? 1);

    this.invoiceService.createInvoice({
      customerId: f.customerId!,
      salesOrderId: f.salesOrderId ?? undefined,
      shipmentId: f.shipmentId ?? undefined,
      invoiceDate: toIsoDate(f.invoiceDate!)!,
      dueDate: toIsoDate(f.dueDate!)!,
      creditTerms: f.creditTerms ?? undefined,
      taxRate: (f.taxRate ?? 0) / 100,
      currencyId,
      fxRate,
      notes: f.notes || undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('invoices.invoiceCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
