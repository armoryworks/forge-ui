import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, output, signal, Signal, ViewChild, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, EMPTY, map, Observable, of, startWith, Subject, switchMap } from 'rxjs';

import { SalesOrderService } from '../../services/sales-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerAddressService } from '../../../customers/services/customer-address.service';
import { CreditStatus } from '../../../customers/models/credit-status.model';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { AdminService } from '../../../admin/services/admin.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateSalesOrderLineRequest } from '../../models/create-sales-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { PaymentTermsService } from '../../../../shared/services/payment-terms.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { CUSTOMER_COMMERCIAL_TERMS_ROLES } from '../../../customers/customer-roles';
import { DocumentLineType } from '../../../../shared/models/document-line-type.type';
import { FREIGHT_TERMS, FreightTerms } from '../../../../shared/models/freight-terms.const';
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
  lineType?: DocumentLineType;
  taxable?: boolean;
}

@Component({
  selector: 'app-so-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    EntityPickerComponent, CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule, DocumentCurrencyComponent,
    TaxOverrideFieldsComponent,
  ],
  templateUrl: './so-dialog.component.html',
  styleUrl: './so-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly documentCurrency = viewChild(DocumentCurrencyComponent);
  protected readonly customerCurrencyId = signal<number | null>(null);
  protected readonly documentCurrencyCode = computed(() => this.documentCurrency()?.selectedCode() ?? null);
  @ViewChild('customerPicker') private customerPicker?: EntityPickerComponent;
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly adminService = inject(AdminService);
  private readonly addressService = inject(CustomerAddressService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly paymentTerms = inject(PaymentTermsService).ensureLoaded();
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Whether the shop allows a manual order-number override on create/rename. */
  protected readonly allowManualOrderNumbers = computed(() => this.manualNumberSettings.isEnabled('salesOrders'));

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly selectedPart = signal<PartListItem | null>(null);
  protected readonly lines = signal<LineEntry[]>([]);
  protected readonly addresses = signal<CustomerAddress[]>([]);
  protected readonly creditStatus = signal<CreditStatus | null>(null);
  protected readonly priceIsListPrice = signal(false);
  protected readonly taxEditability = signal<CustomerTaxEditability | null>(null);
  protected readonly taxLocked = computed(() => this.taxEditability()?.canEditTax === false);
  private readonly customerName = signal('');
  private readonly priceLookups = new Subject<void>();

  protected readonly shipToOptions = computed<SelectOption[]>(() => this.addressOptions('Shipping'));
  protected readonly billToOptions = computed<SelectOption[]>(() => this.addressOptions('Billing'));

  protected readonly creditHoldMessage = computed(() => {
    const status = this.creditStatus();
    return status?.isOnHold
      ? this.translate.instant('salesOrders.creditHoldWarning', {
        reason: status.holdReason?.trim() || this.translate.instant('onboarding.notSpecified'),
      })
      : null;
  });

  protected readonly partFilters: Record<string, string> = { isActive: 'true' };

  protected readonly creditTermsOptions = this.paymentTerms.options;
  protected readonly canSeeTerms = this.paymentTerms.canRead;

  protected readonly freightTermsOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('freight.terms.customerDefault') },
    ...FREIGHT_TERMS.map(t => ({ value: t, label: this.translate.instant(`freight.terms.${t}`) })),
  ];

  private readonly jurisdiction = signal<SalesTaxRate | null>(null);

  protected readonly freightForm = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });

  readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    shippingAddressId: new FormControl<number | null>(null),
    billingAddressId: new FormControl<number | null>(null),
    // Optional manual override; blank → server auto-generates. Only surfaced when the setting is on.
    orderNumber: new FormControl('', [Validators.maxLength(20)]),
    customerPO: new FormControl(''),
    paymentTermsId: new FormControl<number | null>(null),
    requestedDeliveryDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    taxOverrideReason: new FormControl<TaxOverrideReason | null>(null),
    taxOverrideNote: new FormControl<string | null>(''),
    freightTerms: new FormControl<FreightTerms | null>(null),
    notes: new FormControl(''),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(1, [Validators.min(0.00000001)]),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    shippingAddressId: 'Ship to',
    billingAddressId: 'Bill to',
    customerPO: 'Customer PO',
    paymentTermsId: 'Credit Terms',
    requestedDeliveryDate: 'Delivery Date',
    taxRate: 'Tax Rate',
    taxOverrideReason: this.translate.instant('taxOverride.reason'),
    taxOverrideNote: this.translate.instant('taxOverride.note'),
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    // Phase 3 / WU-10 / F8-partial — fractional qty allowed (decimal(18,4) on
    // server). Min is 0.0001 — no zero / negative.
    quantity: new FormControl<number>(1, [Validators.required, Validators.min(0.0001)]),
    unitPrice: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
  });

  protected readonly lineTotal = computed(() =>
    this.lines().reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );

  protected readonly taxRateValue = toSignal(
    this.form.controls.taxRate.valueChanges.pipe(startWith(this.form.controls.taxRate.value ?? 0)),
    { initialValue: this.form.controls.taxRate.value ?? 0 }
  );
  private readonly customerIdValue = toSignal(
    this.form.controls.customerId.valueChanges.pipe(startWith(this.form.controls.customerId.value)),
    { initialValue: this.form.controls.customerId.value },
  );
  private readonly taxOverrideReasonValue = toSignal(
    this.form.controls.taxOverrideReason.valueChanges.pipe(startWith(this.form.controls.taxOverrideReason.value)),
    { initialValue: this.form.controls.taxOverrideReason.value },
  );
  /** True while the tax rate differs from the customer's computed rate, so an exemption reason is needed. */
  protected readonly taxOverridden = computed(() =>
    this.customerIdValue() != null
    && this.taxEditability()?.rateDetermined !== false
    && isTaxOverride(this.taxRateValue(), (this.jurisdiction()?.rate ?? 0) * 100));
  protected readonly freightTotal = computed(() =>
    this.lines().filter(l => l.lineType === 'Freight').reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );
  protected readonly itemsTotal = computed(() => this.lineTotal() - this.freightTotal());
  private readonly taxableTotal = computed(() =>
    this.lines().filter(l => l.lineType !== 'Freight' || l.taxable).reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
  );
  protected readonly taxAmount = computed(() => (this.taxRateValue() ?? 0) / 100 * this.taxableTotal());
  protected readonly grandTotal = computed(() => this.lineTotal() + this.taxAmount());

  protected readonly draftConfig: DraftConfig = {
    entityType: 'sales-order',
    entityId: 'new',
    route: '/sales-orders',
    snapshotFn: () => {
      const value = this.form.getRawValue();
      return {
        ...value,
        requestedDeliveryDate: toIsoDate(value.requestedDeliveryDate),
        customerName: this.customerName(),
        lines: this.lines(),
      };
    },
    restoreFn: (data) => {
      const customerId = typeof data['customerId'] === 'number' ? data['customerId'] : null;
      const customerName = typeof data['customerName'] === 'string' ? data['customerName'] : '';
      if (customerId != null && customerName) {
        this.customerName.set(customerName);
        this.customerPicker?.setSelected(customerId, customerName);
      }
      this.form.patchValue({
        ...data,
        requestedDeliveryDate: fromIsoDate(data['requestedDeliveryDate'] as string | null | undefined),
      });
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.form.markAsDirty();
    },
  };

  constructor() {
    const customerChanges = this.form.controls.customerId.valueChanges;
    customerChanges.pipe(
      switchMap(customerId => {
        this.addresses.set([]);
        this.form.controls.shippingAddressId.setValue(null);
        this.form.controls.billingAddressId.setValue(null);
        return customerId == null
          ? of<CustomerAddress[]>([])
          : this.addressService.getAddresses(customerId).pipe(catchError(() => of<CustomerAddress[]>([])));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(addresses => this.applyAddresses(addresses));

    customerChanges.pipe(
      switchMap(customerId => {
        this.creditStatus.set(null);
        return customerId == null || !this.auth.hasAnyRole(CUSTOMER_COMMERCIAL_TERMS_ROLES)
          ? of(null)
          : this.customerService.getCreditStatus(customerId).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(status => this.creditStatus.set(status));

    customerChanges.pipe(
      switchMap(customerId => {
        this.taxEditability.set(null);
        this.form.controls.taxRate.enable({ emitEvent: false });
        return customerId == null
          ? EMPTY
          : this.adminService.getTaxRateForCustomer(customerId).pipe(catchError(() => EMPTY));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(rate => {
      this.jurisdiction.set(rate ?? null);
      this.form.controls.taxRate.setValue(rate == null ? 0 : +(rate.rate * 100).toFixed(4));
    });

    effect(() => {
      this.taxOverrideReasonValue();
      syncTaxOverrideValidators(this.form.controls.taxOverrideReason, this.form.controls.taxOverrideNote, this.taxOverridden());
      this.form.updateValueAndValidity({ emitEvent: false });
    });

    customerChanges.pipe(
      switchMap(customerId => customerId == null
        ? EMPTY
        : this.customerService.getTaxEditability(customerId).pipe(catchError(() => EMPTY))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(editability => {
      this.taxEditability.set(editability);
      if (!editability.canEditTax) this.form.controls.taxRate.disable({ emitEvent: false });
    });

    customerChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.lineForm.controls.partId.value != null && !this.lineForm.controls.unitPrice.dirty) {
        this.priceLookups.next();
      }
    });

    this.lineForm.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(partId => {
      if (partId != null) return;
      this.selectedPart.set(null);
      this.lineForm.controls.unitPrice.markAsPristine();
      this.priceLookups.next();
    });

    this.lineForm.controls.quantity.valueChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.lineForm.controls.partId.value != null && !this.lineForm.controls.unitPrice.dirty) {
        this.priceLookups.next();
      }
    });

    this.priceLookups.pipe(
      switchMap(() => this.lookupPendingPrice()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(price => {
      const unitPrice = this.lineForm.controls.unitPrice;
      if (unitPrice.dirty) return;
      unitPrice.setValue(price ?? 0, { emitEvent: false });
      this.priceIsListPrice.set(price != null);
    });

    this.lineForm.controls.unitPrice.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.priceIsListPrice.set(false);
    });
  }

  private addressOptions(type: 'Shipping' | 'Billing'): SelectOption[] {
    const opts: SelectOption[] = this.addresses()
      .filter(a => a.isActive !== false && (a.addressType === type || a.addressType === 'Both'))
      .map(a => ({
        value: a.id,
        label: `${a.label} — ${a.line1}, ${a.city} ${a.state} ${a.postalCode}`.trim(),
      }));
    return [{ value: null, label: this.translate.instant('common.none') }, ...opts];
  }

  private applyAddresses(addresses: CustomerAddress[]): void {
    const active = addresses.filter(a => a.isActive !== false);
    this.addresses.set(active);
    this.applyDefaultAddress(this.form.controls.shippingAddressId, active, 'Shipping');
    this.applyDefaultAddress(this.form.controls.billingAddressId, active, 'Billing');
  }

  private applyDefaultAddress(control: FormControl<number | null>, addresses: CustomerAddress[], type: 'Shipping' | 'Billing'): void {
    const current = control.value;
    if (current != null && addresses.some(a => a.id === current && (a.addressType === type || a.addressType === 'Both'))) return;
    const defaults = addresses.filter(a => a.isDefault);
    const match = defaults.find(a => a.addressType === type) ?? defaults.find(a => a.addressType === 'Both');
    control.setValue(match?.id ?? null);
  }

  private lookupPendingPrice(): Observable<number | null> {
    const partId = this.lineForm.controls.partId.value;
    if (partId == null) return of(null);
    const part = this.selectedPart()?.id === partId ? this.selectedPart() : null;
    const fallback = part && part.effectivePriceSource !== 'Default' && part.effectivePrice > 0
      ? part.effectivePrice
      : null;
    const customerId = this.form.controls.customerId.value;
    if (customerId == null) return of(fallback);
    return this.soService.resolvePrice(customerId, partId, this.lineForm.controls.quantity.value).pipe(
      map(price => price ?? fallback),
      catchError(() => of(fallback)),
    );
  }

  protected onPartPicked(part: Record<string, unknown> | null): void {
    this.selectedPart.set(part as PartListItem | null);
    if (!part) return;
    this.lineForm.controls.unitPrice.markAsPristine();
    this.priceLookups.next();
  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
    const currencyId = customer?.['currencyId'];
    this.customerCurrencyId.set(typeof currencyId === 'number' ? currencyId : null);
    this.customerName.set(customer ? String(customer['name'] ?? '') : '');
  }

  protected close(): void {
    this.closed.emit();
  }

  protected addLine(): void {
    if (this.lineForm.invalid) return;
    if (Number(this.lineForm.controls.unitPrice.value) === 0) {
      this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: this.translate.instant('salesOrders.addLine'),
          message: this.translate.instant('salesOrders.zeroPriceConfirm'),
          confirmLabel: this.translate.instant('common.add'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      }).afterClosed().subscribe(confirmed => {
        if (confirmed) this.commitLine();
      });
      return;
    }
    this.commitLine();
  }

  private commitLine(): void {
    if (this.lineForm.invalid) return;
    const f = this.lineForm.getRawValue();
    const part = this.selectedPart();
    if (!part || part.id !== f.partId) return;
    this.lines.update(prev => {
      const entry: LineEntry = {
        partId: part.id,
        partNumber: part.partNumber,
        // Phase-4 Name+Description split: line carries the part's short
        // identifier — Name is now the canonical short identifier.
        description: part.name,
        quantity: f.quantity!,
        unitPrice: f.unitPrice!,
      };
      const firstFreight = prev.findIndex(l => l.lineType === 'Freight');
      return firstFreight < 0 ? [...prev, entry] : [...prev.slice(0, firstFreight), entry, ...prev.slice(firstFreight)];
    });
    this.lineForm.reset({ partId: null, quantity: 1, unitPrice: 0 });
    this.priceIsListPrice.set(false);
  }

  protected addFreight(): void {
    if (this.freightForm.invalid) return;
    const amount = Number(this.freightForm.controls.amount.value ?? 0);
    this.lines.update(prev => [...prev, {
      partId: null,
      partNumber: '',
      description: this.translate.instant('freight.defaultDescription'),
      quantity: 1,
      unitPrice: amount,
      lineType: 'Freight',
      taxable: this.jurisdiction()?.freightTaxable ?? false,
    }]);
    this.freightForm.reset({ amount: null });
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreateSalesOrderLineRequest[] = this.lines().map(l => l.lineType === 'Freight'
      ? { description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineType: 'Freight', taxable: l.taxable ?? false }
      : { partId: l.partId ?? undefined, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice });

    this.soService.createSalesOrder({
      customerId: f.customerId!,
      shippingAddressId: f.shippingAddressId ?? undefined,
      billingAddressId: f.billingAddressId ?? undefined,
      orderNumber: this.allowManualOrderNumbers() ? (f.orderNumber?.trim() || undefined) : undefined,
      paymentTermsId: f.paymentTermsId ?? undefined,
      requestedDeliveryDate: toIsoDate(f.requestedDeliveryDate) || undefined,
      customerPO: f.customerPO || undefined,
      notes: f.notes || undefined,
      taxRate: (f.taxRate ?? 0) / 100,
      ...taxOverridePayload(this.taxOverridden(), f.taxOverrideReason, f.taxOverrideNote),
      freightTerms: f.freightTerms ?? undefined,
      currencyId: this.documentCurrency()?.visible() ? (f.currencyId ?? undefined) : undefined,
      fxRate: this.documentCurrency()?.visible() && this.documentCurrency()?.isForeign() ? f.fxRate : undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('salesOrders.soCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
