import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, output, signal, Signal, ViewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, map, Observable, of, startWith, Subject, switchMap } from 'rxjs';

import { SalesOrderService } from '../../services/sales-order.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { CustomerAddressService } from '../../../customers/services/customer-address.service';
import { CreditStatus } from '../../../customers/models/credit-status.model';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { PartsService } from '../../../parts/services/parts.service';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { AdminService } from '../../../admin/services/admin.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateSalesOrderLineRequest } from '../../models/create-sales-order-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { AutocompleteComponent, AutocompleteOption } from '../../../../shared/components/autocomplete/autocomplete.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { CREDIT_TERMS_OPTIONS } from '../../../../shared/models/credit-terms.const';

interface LineEntry {
  partId: number;
  partNumber: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-so-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    AutocompleteComponent, EntityPickerComponent, CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './so-dialog.component.html',
  styleUrl: './so-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  @ViewChild(EntityPickerComponent) private customerPicker?: EntityPickerComponent;
  private readonly soService = inject(SalesOrderService);
  private readonly customerService = inject(CustomerService);
  private readonly adminService = inject(AdminService);
  private readonly addressService = inject(CustomerAddressService);
  private readonly dialog = inject(MatDialog);
  private readonly partsService = inject(PartsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Whether the shop allows a manual order-number override on create/rename. */
  protected readonly allowManualOrderNumbers = computed(() => this.manualNumberSettings.isEnabled('salesOrders'));

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly parts = signal<PartListItem[]>([]);
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

  protected readonly partOptions = computed<AutocompleteOption[]>(() =>
    this.parts().map(p => ({ value: p.id, label: `${p.partNumber} — ${p.name}` })));

  protected readonly creditTermsOptions = CREDIT_TERMS_OPTIONS;

  readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    shippingAddressId: new FormControl<number | null>(null),
    billingAddressId: new FormControl<number | null>(null),
    // Optional manual override; blank → server auto-generates. Only surfaced when the setting is on.
    orderNumber: new FormControl('', [Validators.maxLength(20)]),
    customerPO: new FormControl(''),
    creditTerms: new FormControl<string | null>(null),
    requestedDeliveryDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl(''),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    shippingAddressId: 'Ship to',
    billingAddressId: 'Bill to',
    customerPO: 'Customer PO',
    creditTerms: 'Credit Terms',
    requestedDeliveryDate: 'Delivery Date',
    taxRate: 'Tax Rate',
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
  protected readonly taxAmount = computed(() => (this.taxRateValue() ?? 0) / 100 * this.lineTotal());
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
    this.partsService.getParts('Active').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => this.parts.set(list),
    });

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
        return customerId == null
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
    ).subscribe(rate => this.form.controls.taxRate.setValue(rate == null ? 0 : +(rate.rate * 100).toFixed(4)));

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

    this.lineForm.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.lineForm.controls.unitPrice.markAsPristine();
      this.priceLookups.next();
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
    const part = this.parts().find(p => p.id === partId);
    const fallback = part && part.effectivePriceSource !== 'Default' && part.effectivePrice > 0
      ? part.effectivePrice
      : null;
    const customerId = this.form.controls.customerId.value;
    if (customerId == null) return of(fallback);
    return this.soService.resolvePrice(customerId, partId).pipe(
      map(price => price ?? fallback),
      catchError(() => of(fallback)),
    );
  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
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
    const part = this.parts().find(p => p.id === f.partId);
    if (!part) return;
    this.lines.update(prev => [...prev, {
      partId: part.id,
      partNumber: part.partNumber,
      // Phase-4 Name+Description split: line carries the part's short
      // identifier — Name is now the canonical short identifier.
      description: part.name,
      quantity: f.quantity!,
      unitPrice: f.unitPrice!,
    }]);
    this.lineForm.reset({ partId: null, quantity: 1, unitPrice: 0 });
    this.priceIsListPrice.set(false);
  }

  protected removeLine(index: number): void {
    this.lines.update(prev => prev.filter((_, i) => i !== index));
  }

  protected save(): void {
    if (this.form.invalid || this.lines().length === 0) return;
    this.saving.set(true);

    const f = this.form.getRawValue();
    const lineRequests: CreateSalesOrderLineRequest[] = this.lines().map(l => ({
      partId: l.partId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    this.soService.createSalesOrder({
      customerId: f.customerId!,
      shippingAddressId: f.shippingAddressId ?? undefined,
      billingAddressId: f.billingAddressId ?? undefined,
      orderNumber: this.allowManualOrderNumbers() ? (f.orderNumber?.trim() || undefined) : undefined,
      creditTerms: f.creditTerms || undefined,
      requestedDeliveryDate: toIsoDate(f.requestedDeliveryDate) || undefined,
      customerPO: f.customerPO || undefined,
      notes: f.notes || undefined,
      taxRate: (f.taxRate ?? 0) / 100,
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
