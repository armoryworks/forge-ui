import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, output, computed, ViewChild, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, distinctUntilChanged, of, startWith, switchMap } from 'rxjs';

import { InvoiceService } from '../../services/invoice.service';
import { AdminService } from '../../../admin/services/admin.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { InvoiceSources } from '../../models/invoice-sources.model';
import { InvoiceSourceShipment } from '../../models/invoice-source-shipment.model';
import { CreateInvoiceLineRequest } from '../../models/create-invoice-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { formatDate, toCalendarDate, toIsoDate, todayEnd, todayStart } from '../../../../shared/utils/date.utils';
import { roundMoney } from '../../../../shared/utils/money.utils';
import { dateOrderValidator } from '../../../../shared/validators/date-order.validator';
import { PaymentTermsService } from '../../../../shared/services/payment-terms.service';
import { discountDateForTerms, dueDateForTerms } from '../../../../shared/utils/payment-terms.utils';
import { CustomerDetail } from '../../../customers/models/customer-detail.model';
import { DocumentLineType } from '../../../../shared/models/document-line-type.type';
import { SalesTaxRate } from '../../../admin/models/sales-tax-rate.model';
import { TaxOverrideFieldsComponent } from '../../../../shared/components/tax-override-fields/tax-override-fields.component';
import { TaxOverrideReason } from '../../../../shared/models/tax-override-reason.type';
import { isTaxOverride, syncTaxOverrideValidators, taxOverridePayload } from '../../../../shared/utils/tax-override.utils';

interface LineEntry {
  partId: number | null;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  salesOrderLineId?: number | null;
  lineType?: DocumentLineType;
}

// ---- ACCOUNTING BOUNDARY ----

@Component({
  selector: 'app-invoice-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, EntityPickerComponent, DatepickerComponent, TextareaComponent,
    CurrencyDisplayComponent, ValidationButtonComponent, MatTooltipModule, DocumentCurrencyComponent, TaxOverrideFieldsComponent,
  ],
  templateUrl: './invoice-dialog.component.html',
  styleUrl: './invoice-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  @ViewChild('customerPicker') private customerPicker?: EntityPickerComponent;
  private readonly documentCurrency = viewChild(DocumentCurrencyComponent);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manualNumbers = inject(ManualNumberSettingsService);
  private readonly paymentTerms = inject(PaymentTermsService).ensureLoaded();

  /** Whether the tenant allows a manual invoice-number override on create. */
  protected readonly allowManualInvoiceNumbers = computed(() => this.manualNumbers.isEnabled('invoices'));

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
  private readonly customerName = signal('');
  /** Phase 1l — invoice issue date is when it was issued; not future. */
  protected readonly today = todayEnd();
  protected readonly lines = signal<LineEntry[]>([]);
  private prefilledLines: LineEntry[] | null = null;
  protected readonly sources = signal<InvoiceSources>({ salesOrders: [], shipments: [] });
  protected readonly customerDetail = signal<CustomerDetail | null>(null);
  private readonly jurisdiction = signal<SalesTaxRate | null>(null);

  protected readonly customerFilters: Record<string, string> = { isActive: 'true' };

  protected readonly salesOrderOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('common.none') },
    ...this.sources().salesOrders.map(so => ({ value: so.id, label: `${so.orderNumber} — ${so.customerName}` })),
  ]);

  protected readonly creditTermsOptions = this.paymentTerms.options;

  protected readonly invoiceForm = new FormGroup({
    invoiceNumber: new FormControl('', [Validators.maxLength(20)]),
    customerId: new FormControl<number | null>(null, [Validators.required]),
    salesOrderId: new FormControl<number | null>(null),
    shipmentId: new FormControl<number | null>(null),
    invoiceDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    dueDate: new FormControl<Date | null>(null, [Validators.required]),
    paymentTermsId: new FormControl<number | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    taxOverrideReason: new FormControl<TaxOverrideReason | null>(null),
    taxOverrideNote: new FormControl<string | null>(''),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(1, [Validators.min(0.00000001)]),
    notes: new FormControl(''),
  }, {
    validators: [dateOrderValidator('invoiceDate', 'dueDate', () => this.translate.instant('validation.dateRangeOrder', {
      start: this.translate.instant('invoices.invoiceDate'),
      end: this.translate.instant('invoices.dueDate'),
    }))],
  });

  private readonly selectedCustomerId = toSignal(
    this.invoiceForm.controls.customerId.valueChanges.pipe(startWith(this.invoiceForm.controls.customerId.value)),
    { initialValue: this.invoiceForm.controls.customerId.value },
  );

  private readonly selectedSalesOrderId = toSignal(
    this.invoiceForm.controls.salesOrderId.valueChanges.pipe(
      startWith(this.invoiceForm.controls.salesOrderId.value),
    ),
    { initialValue: this.invoiceForm.controls.salesOrderId.value },
  );

  protected readonly shipmentOptions = computed<SelectOption[]>(() => {
    const salesOrderId = this.selectedSalesOrderId();
    return [
      { value: null, label: this.translate.instant('common.none') },
      ...this.sources().shipments
        .filter(s => salesOrderId == null || s.salesOrderId === salesOrderId)
        .map(s => ({
          value: s.id,
          label: s.shippedDate ? `${s.shipmentNumber} — ${formatDate(s.shippedDate)}` : s.shipmentNumber,
        })),
    ];
  });

  protected readonly violations = FormValidationService.getViolations(this.invoiceForm, {
    invoiceNumber: this.translate.instant('invoices.invoiceNumberLabel'),
    customerId: this.translate.instant('invoices.customer'),
    salesOrderId: this.translate.instant('invoices.salesOrderId'),
    shipmentId: this.translate.instant('invoices.shipmentId'),
    invoiceDate: this.translate.instant('invoices.invoiceDate'),
    dueDate: this.translate.instant('invoices.dueDate'),
    paymentTermsId: this.translate.instant('invoices.creditTerms'),
    taxRate: this.translate.instant('invoices.taxRate'),
    taxOverrideReason: this.translate.instant('taxOverride.reason'),
    taxOverrideNote: this.translate.instant('taxOverride.note'),
    currencyId: this.translate.instant('accounting.currency.currency'),
    fxRate: this.translate.instant('accounting.currency.fxRate'),
    notes: this.translate.instant('common.notes'),
  });

  protected readonly lineTypeOptions: SelectOption[] = [
    { value: 'Item', label: this.translate.instant('freight.lineTypeItem') },
    { value: 'Freight', label: this.translate.instant('freight.lineTypeFreight') },
  ];

  // Line item form
  protected readonly lineForm = new FormGroup({
    lineType: new FormControl<DocumentLineType>('Item', { nonNullable: true }),
    partId: new FormControl<number | null>(null),
    partNumber: new FormControl(''),
    description: new FormControl('', [Validators.required]),
    // Phase 3 / WU-23 (F8-broad): fractional UoM-aware quantities accepted.
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineAmounts = computed(() =>
    this.lines().map(l => roundMoney(l.quantity * l.unitPrice))
  );

  protected readonly lineTotal = computed(() =>
    roundMoney(this.lineAmounts().reduce((sum, amount) => sum + amount, 0))
  );

  protected readonly freightTotal = computed(() =>
    roundMoney(this.lineAmounts().reduce((sum, amount, i) => (this.lines()[i].lineType === 'Freight' ? sum + amount : sum), 0))
  );

  protected readonly itemsTotal = computed(() => roundMoney(this.lineTotal() - this.freightTotal()));

  protected readonly addingFreight = toSignal(
    this.lineForm.controls.lineType.valueChanges.pipe(startWith(this.lineForm.controls.lineType.value)),
    { initialValue: this.lineForm.controls.lineType.value },
  );

  /** Shipment-source warnings (e.g. the order's freight was already billed), as translation keys. */
  protected readonly sourceWarnings = signal<string[]>([]);

  protected readonly taxableTotal = computed(() =>
    roundMoney(this.lineAmounts().reduce((sum, amount, i) => (this.lines()[i].taxable ? sum + amount : sum), 0))
  );

  protected readonly taxRateValue = toSignal(
    this.invoiceForm.controls.taxRate.valueChanges.pipe(startWith(this.invoiceForm.controls.taxRate.value ?? 0)),
    { initialValue: this.invoiceForm.controls.taxRate.value ?? 0 }
  );
  protected readonly documentCurrencyCode = computed(() => this.documentCurrency()?.selectedCode() ?? null);
  protected readonly defaultCurrencyId = computed<number | null>(() => {
    const salesOrderId = this.selectedSalesOrderId();
    const order = salesOrderId == null ? undefined : this.sources().salesOrders.find(so => so.id === salesOrderId);
    return order?.currencyId ?? this.customerDetail()?.currencyId ?? null;
  });
  protected readonly invoiceDateValue = toSignal(
    this.invoiceForm.controls.invoiceDate.valueChanges.pipe(startWith(this.invoiceForm.controls.invoiceDate.value)),
    { initialValue: this.invoiceForm.controls.invoiceDate.value },
  );

  /** True when the picked customer's exemption certificate covers the invoice date; the server bills no tax then. */
  protected readonly customerTaxExempt = computed(() => {
    const customer = this.customerDetail();
    if (!customer?.isTaxExempt) return false;
    if (!customer.exemptionExpiryDate) return true;
    const invoiceDate = this.invoiceDateValue() ?? todayStart();
    const expiry = toCalendarDate(customer.exemptionExpiryDate);
    return toIsoDate(expiry)! >= toIsoDate(invoiceDate)!;
  });

  private readonly paymentTermsIdValue = toSignal(
    this.invoiceForm.controls.paymentTermsId.valueChanges.pipe(startWith(this.invoiceForm.controls.paymentTermsId.value)),
    { initialValue: this.invoiceForm.controls.paymentTermsId.value },
  );

  /** The early-payment discount the picked terms offer on this invoice, or null when they carry none. */
  protected readonly discountOffer = computed(() => {
    const terms = this.paymentTerms.find(this.paymentTermsIdValue());
    const invoiceDate = this.invoiceDateValue();
    const until = invoiceDate ? discountDateForTerms(toCalendarDate(invoiceDate), terms) : null;
    if (!terms || !until) return null;
    return { percent: terms.discountPercent, date: formatDate(until), amount: roundMoney(this.grandTotal() * terms.discountPercent / 100) };
  });

  protected readonly effectiveTaxRate = computed(() => (this.customerTaxExempt() ? 0 : (this.taxRateValue() ?? 0)));

  private readonly taxOverrideReasonValue = toSignal(
    this.invoiceForm.controls.taxOverrideReason.valueChanges.pipe(startWith(this.invoiceForm.controls.taxOverrideReason.value)),
    { initialValue: this.invoiceForm.controls.taxOverrideReason.value },
  );

  /** True when the typed rate differs from both the customer's computed rate and the picked sales order's rate. */
  protected readonly taxOverridden = computed(() => {
    if (this.customerTaxExempt() || this.selectedCustomerId() == null) return false;
    const rate = this.taxRateValue();
    const salesOrderId = this.selectedSalesOrderId();
    const order = salesOrderId == null ? undefined : this.sources().salesOrders.find(so => so.id === salesOrderId);
    if (order && !isTaxOverride(rate, order.taxRate * 100)) return false;
    return isTaxOverride(rate, (this.jurisdiction()?.rate ?? 0) * 100);
  });
  protected readonly taxAmount = computed(() => roundMoney(this.effectiveTaxRate() / 100 * this.taxableTotal()));
  protected readonly grandTotal = computed(() => roundMoney(this.lineTotal() + this.taxAmount()));

  protected readonly draftConfig: DraftConfig = {
    entityType: 'invoice',
    entityId: 'new',
    route: '/invoices',
    snapshotFn: () => ({ ...this.invoiceForm.getRawValue(), customerName: this.customerName(), lines: this.lines() }),
    restoreFn: (data) => {
      const customerId = typeof data['customerId'] === 'number' ? data['customerId'] : null;
      const customerName = typeof data['customerName'] === 'string' ? data['customerName'] : '';
      if (customerId != null && customerName && !this.invoiceForm.controls.customerId.disabled) {
        this.customerName.set(customerName);
        this.customerPicker?.setSelected(customerId, customerName);
      }
      this.invoiceForm.patchValue(data);
      if (Array.isArray(data['lines'])) {
        this.lines.set((data['lines'] as LineEntry[]).map(l => ({ ...l, taxable: l.taxable ?? true })));
      }
      this.invoiceForm.controls.taxRate.markAsDirty();
      this.invoiceForm.markAsDirty();
    },
  };

  constructor() {
    const controls = this.invoiceForm.controls;
    controls.customerId.valueChanges.pipe(
      startWith(controls.customerId.value),
      distinctUntilChanged(),
      switchMap((customerId, index) => {
        if (index > 0) {
          controls.salesOrderId.setValue(null);
          controls.shipmentId.setValue(null);
        }
        this.sources.set({ salesOrders: [], shipments: [] });
        if (customerId == null) return EMPTY;
        return this.invoiceService.getInvoiceSources(customerId).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((sources) => {
      if (!sources) return;
      this.sources.set(sources);
      const order = sources.salesOrders.find(so => so.id === controls.salesOrderId.value);
      if (order) this.applyDefaultTaxRate(order.taxRate);
    });

    controls.customerId.valueChanges.pipe(
      startWith(controls.customerId.value),
      distinctUntilChanged(),
      switchMap(customerId => {
        this.customerDetail.set(null);
        return customerId == null
          ? EMPTY
          : this.customerService.getCustomerById(customerId).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(customer => {
      this.customerDetail.set(customer);
      if (controls.salesOrderId.value == null) this.applyDefaultTerms(this.customerTermsId(customer));
    });

    effect(() => {
      this.taxOverrideReasonValue();
      const { taxOverrideReason, taxOverrideNote } = this.invoiceForm.controls;
      syncTaxOverrideValidators(taxOverrideReason, taxOverrideNote, this.taxOverridden());
      this.invoiceForm.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      const taxRate = this.invoiceForm.controls.taxRate;
      if (this.customerTaxExempt()) taxRate.disable({ emitEvent: false });
      else taxRate.enable({ emitEvent: false });
    });

    controls.customerId.valueChanges.pipe(
      startWith(controls.customerId.value),
      distinctUntilChanged(),
      switchMap(customerId => {
        this.jurisdiction.set(null);
        return customerId == null
          ? EMPTY
          : this.adminService.getTaxRateForCustomer(customerId).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(rate => {
      this.jurisdiction.set(rate ?? null);
      if (controls.salesOrderId.value == null) this.applyDefaultTaxRate(rate?.rate ?? 0);
    });

    this.lineForm.controls.lineType.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(lineType => {
      const { partId, partNumber, description } = this.lineForm.controls;
      if (lineType === 'Freight') {
        partId.setValue(null);
        partNumber.setValue('');
        partId.disable();
        if (!description.value) description.setValue(this.translate.instant('freight.defaultDescription'));
      } else {
        partId.enable();
      }
    });

    controls.salesOrderId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((salesOrderId) => {
      const shipment = this.sources().shipments.find(s => s.id === controls.shipmentId.value);
      if (salesOrderId != null && shipment && shipment.salesOrderId !== salesOrderId) {
        controls.shipmentId.setValue(null);
      }
      const order = this.sources().salesOrders.find(so => so.id === salesOrderId);
      if (order) {
        this.applyDefaultTaxRate(order.taxRate);
        this.applyDefaultTerms(
          order.paymentTermsId ?? this.paymentTerms.forLegacy(order.creditTerms)?.id ?? this.customerTermsId(this.customerDetail()),
        );
      }
    });

    controls.dueDate.addValidators(control => this.dueDateTermsError(control.value as Date | null));
    controls.paymentTermsId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyTermsDueDate());
    controls.invoiceDate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.applyTermsDueDate());

    controls.shipmentId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((shipmentId) => {
      const shipment = this.sources().shipments.find(s => s.id === shipmentId);
      if (shipment && controls.salesOrderId.value == null) {
        controls.salesOrderId.setValue(shipment.salesOrderId);
      }
      this.prefillLinesFrom(shipment);
    });

    // Apply the SO-context pre-link once inputs resolve. save() reads
    // getRawValue(), so the disabled customer control still submits.
    effect(() => {
      const customerId = this.initialCustomerId();
      const salesOrderId = this.initialSalesOrderId();
      if (customerId != null && this.invoiceForm.controls.customerId.value === null) {
        this.invoiceForm.controls.customerId.setValue(customerId);
        this.invoiceForm.controls.customerId.disable();
        this.customerService.getCustomerById(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (customer) => {
            this.customerName.set(customer.name);
            this.customerPicker?.setSelected(customer.id, customer.name);
          },
        });
      }
      if (salesOrderId != null && this.invoiceForm.controls.salesOrderId.value === null) {
        this.invoiceForm.controls.salesOrderId.setValue(salesOrderId);
      }
    });

  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
    this.customerName.set(customer ? String(customer['name'] ?? '') : '');
  }

  protected close(): void {
    this.closed.emit();
  }

  private customerTermsId(customer: CustomerDetail | null): number | null {
    if (!customer) return null;
    return customer.paymentTermsId ?? this.paymentTerms.forLegacy(customer.defaultCreditTerms)?.id ?? null;
  }

  private applyDefaultTerms(paymentTermsId: number | null): void {
    const control = this.invoiceForm.controls.paymentTermsId;
    if (control.dirty || paymentTermsId == null) return;
    control.setValue(paymentTermsId);
  }

  private termsDueDate(): Date | null {
    const { invoiceDate, paymentTermsId } = this.invoiceForm.controls;
    return invoiceDate.value ? dueDateForTerms(toCalendarDate(invoiceDate.value), this.paymentTerms.find(paymentTermsId.value)) : null;
  }

  private applyTermsDueDate(): void {
    const due = this.termsDueDate();
    if (due) this.invoiceForm.controls.dueDate.setValue(due);
    else this.invoiceForm.controls.dueDate.updateValueAndValidity();
  }

  private dueDateTermsError(dueDate: Date | null): ValidationErrors | null {
    const expected = this.termsDueDate();
    if (!dueDate || !expected || toIsoDate(dueDate) === toIsoDate(expected)) return null;
    const terms = this.paymentTerms.find(this.invoiceForm.controls.paymentTermsId.value)?.name ?? '';
    return {
      termsMismatch: {
        message: this.translate.instant('invoices.dueDateTermsMismatch', { terms, date: formatDate(expected) }),
      },
    };
  }

  private applyDefaultTaxRate(rate: number): void {
    const control = this.invoiceForm.controls.taxRate;
    if (control.dirty) return;
    control.setValue(+(rate * 100).toFixed(4));
  }

  protected toggleTaxable(index: number): void {
    this.lines.update(prev => prev.map((l, i) => (i === index ? { ...l, taxable: !l.taxable } : l)));
  }

  /** A new freight line is taxable only when the customer's jurisdiction taxes freight and the customer is not exempt. */
  private freightStartsTaxable(): boolean {
    return (this.jurisdiction()?.freightTaxable ?? false) && !this.customerTaxExempt();
  }

  protected startFreightLine(): void {
    this.lineForm.controls.lineType.setValue('Freight');
  }

  private prefillLinesFrom(shipment: InvoiceSourceShipment | undefined): void {
    this.sourceWarnings.set((shipment?.warnings ?? []).map(code => `freight.warnings.${code}`));
    const untouched = this.lines().length === 0 || this.lines() === this.prefilledLines;
    if (!untouched) return;
    if (!shipment || shipment.lines.length === 0) {
      if (this.prefilledLines && this.lines() === this.prefilledLines) this.lines.set([]);
      this.prefilledLines = null;
      return;
    }
    const entries: LineEntry[] = shipment.lines.map(l => {
      const shipmentCharge = l.lineType === 'Freight' && l.salesOrderLineId == null;
      return {
        partId: l.partId,
        partNumber: l.partNumber ?? '',
        description: shipmentCharge ? this.translate.instant('freight.defaultDescription') : l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxable: shipmentCharge ? this.freightStartsTaxable() : (l.taxable ?? true),
        salesOrderLineId: l.salesOrderLineId ?? null,
        lineType: l.lineType ?? 'Item',
      };
    });
    this.prefilledLines = entries;
    this.lines.set(entries);
  }

  protected onPartPicked(entity: Record<string, unknown> | null): void {
    const part = entity as PartListItem | null;
    if (!part) {
      this.lineForm.controls.partNumber.setValue('');
      return;
    }
    this.lineForm.patchValue({
      partNumber: part.partNumber,
      description: part.name,
      ...(part.effectivePriceSource !== 'Default' && part.effectivePrice > 0 ? { unitPrice: part.effectivePrice } : {}),
    });
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const isFreight = f.lineType === 'Freight';
    const entry: LineEntry = {
      partId: isFreight ? null : (f.partId ?? null),
      partNumber: isFreight ? '' : (f.partNumber ?? ''),
      description: f.description ?? '',
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
      taxable: isFreight ? this.freightStartsTaxable() : true,
      lineType: f.lineType,
    };
    this.lines.update(prev => {
      if (isFreight) return [...prev, entry];
      const firstFreight = prev.findIndex(l => l.lineType === 'Freight');
      return firstFreight < 0 ? [...prev, entry] : [...prev.slice(0, firstFreight), entry, ...prev.slice(firstFreight)];
    });
    this.lineForm.reset({ lineType: 'Item', partId: null, partNumber: '', description: '', quantity: 1, unitPrice: 0 });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.invoiceForm.invalid || this.lines().length === 0 || this.saving()) return;
    this.saving.set(true);

    const f = this.invoiceForm.getRawValue();
    const lineRequests: CreateInvoiceLineRequest[] = this.lines().map(l => ({
      partId: l.partId ?? undefined,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxable: l.taxable,
      salesOrderLineId: l.salesOrderLineId ?? undefined,
      lineType: l.lineType ?? 'Item',
    }));

    const currencyField = this.documentCurrency();
    const currencyId = currencyField?.visible() ? (f.currencyId ?? undefined) : undefined;
    const fxRate = currencyField?.visible() && currencyField.isForeign() ? f.fxRate : undefined;

    this.invoiceService.createInvoice({
      invoiceNumber: this.allowManualInvoiceNumbers() ? (f.invoiceNumber?.trim() || undefined) : undefined,
      customerId: f.customerId!,
      salesOrderId: f.salesOrderId ?? undefined,
      shipmentId: f.shipmentId ?? undefined,
      invoiceDate: toIsoDate(f.invoiceDate!)!,
      dueDate: toIsoDate(f.dueDate!)!,
      paymentTermsId: f.paymentTermsId ?? undefined,
      taxRate: this.effectiveTaxRate() / 100,
      ...taxOverridePayload(this.taxOverridden(), f.taxOverrideReason, f.taxOverrideNote),
      currencyId,
      fxRate,
      notes: f.notes || undefined,
      salesTaxRateId: this.jurisdiction()?.id,
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
