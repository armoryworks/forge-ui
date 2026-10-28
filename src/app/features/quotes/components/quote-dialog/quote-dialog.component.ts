import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, output, signal, Signal, ViewChild, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { QuoteService } from '../../services/quote.service';
import { CustomerService } from '../../../customers/services/customer.service';
import { AdminService } from '../../../admin/services/admin.service';
import { CustomerTaxEditability } from '../../../customers/models/customer-tax-editability.model';
import { CreditStatus } from '../../../customers/models/credit-status.model';
import { CUSTOMER_COMMERCIAL_TERMS_ROLES } from '../../../customers/customer-roles';
import { AuthService } from '../../../../shared/services/auth.service';
import { PartListItem } from '../../../parts/models/part-list-item.model';
import { CreateQuoteLineRequest } from '../../models/create-quote-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DraftConfig } from '../../../../shared/models/draft-config.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { roundMoney, UNIT_DECIMALS } from '../../../../shared/utils/money';
import { maxDecimalsValidator } from '../../../../shared/validators/max-decimals.validator';
import { DocumentLineType } from '../../../../shared/models/document-line-type.type';
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
}

// S2 note: this dialog deliberately has NO payment-schedule editor. Schedules
// attach to SAVED quotes (the PUT is addressed by quoteId), so the quote
// detail panel's "Payment Schedule" section is the single home for authoring
// and editing them (see payment-schedule-dialog.component.ts).
@Component({
  selector: 'app-quote-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe,
    DialogComponent, InputComponent, DatepickerComponent, TextareaComponent,
    EntityPickerComponent, CurrencyDisplayComponent, ValidationButtonComponent, TranslatePipe, MatTooltipModule, DocumentCurrencyComponent,
    TaxOverrideFieldsComponent,
  ],
  templateUrl: './quote-dialog.component.html',
  styleUrl: './quote-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;
  private readonly documentCurrency = viewChild(DocumentCurrencyComponent);
  protected readonly customerCurrencyId = signal<number | null>(null);
  protected readonly documentCurrencyCode = computed(() => this.documentCurrency()?.selectedCode() ?? null);
  @ViewChild('customerPicker') private customerPicker?: EntityPickerComponent;
  private readonly quoteService = inject(QuoteService);
  private readonly customerService = inject(CustomerService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  /** Whether the shop allows a manual quote-number override on create/rename. */
  protected readonly allowManualQuoteNumbers = computed(() => this.manualNumberSettings.isEnabled('quotes'));

  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly selectedPart = signal<PartListItem | null>(null);
  private readonly customerName = signal('');
  protected readonly lines = signal<LineEntry[]>([]);
  /** True while the unit price reflects the part's list price and hasn't been manually edited. */
  protected readonly priceIsDefault = signal(false);
  /** True while the tax rate was auto-filled from the customer's state and hasn't been manually edited. */
  protected readonly taxAutoFilled = signal(false);
  /** Display label for the auto-filled tax rate (e.g. "CA 7.25%"). */
  protected readonly taxAutoLabel = signal('');
  /** Server verdict on whether the caller may override this customer's tax rate. */
  protected readonly taxEditability = signal<CustomerTaxEditability | null>(null);
  /** Tax field locked: editability is known and the caller's role may not override the rate. */
  protected readonly taxLocked = computed(() => this.taxEditability()?.canEditTax === false);
  protected readonly creditStatus = signal<CreditStatus | null>(null);
  protected readonly creditHoldMessage = computed(() => {
    const status = this.creditStatus();
    return status?.isOnHold
      ? this.translate.instant('quotes.creditHoldWarning', {
        reason: status.holdReason?.trim() || this.translate.instant('onboarding.notSpecified'),
      })
      : null;
  });
  /** The customer's computed tax rate in percent; 0 when none is configured. */
  private readonly defaultTaxPercent = signal(0);
  private readonly customerPicked = signal(false);
  /** True while the tax rate differs from the customer's computed rate, so an exemption reason is needed. */
  protected readonly taxOverridden = computed(
    () => this.customerPicked()
      && this.taxEditability()?.rateDetermined !== false
      && isTaxOverride(this.taxRateValue(), this.defaultTaxPercent()));
  /** The override is backed by a verified certificate on file (badge cue). */
  protected readonly taxCertBacked = computed(
    () => this.taxOverridden() && this.taxEditability()?.activeDocumentId != null);

  protected readonly customerFilters: Record<string, string> = { isActive: 'true' };
  protected readonly partFilters: Record<string, string> = { isActive: 'true' };

  readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    // Optional manual override; blank → server auto-generates. Only surfaced when the setting is on.
    quoteNumber: new FormControl('', [Validators.maxLength(20)]),
    expirationDate: new FormControl<Date | null>(null),
    taxRate: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    taxOverrideReason: new FormControl<TaxOverrideReason | null>(null),
    taxOverrideNote: new FormControl<string | null>(''),
    customerPO: new FormControl('', [Validators.maxLength(50)]),
    notes: new FormControl(''),
    currencyId: new FormControl<number | null>(null),
    fxRate: new FormControl<number | null>(1, [Validators.min(0.00000001)]),
  });

  private readonly formViolations = FormValidationService.getViolations(this.form, {
    customerId: 'Customer',
    expirationDate: 'Expiration Date',
    taxRate: 'Tax Rate',
    taxOverrideReason: this.translate.instant('taxOverride.reason'),
    taxOverrideNote: this.translate.instant('taxOverride.note'),
    customerPO: 'Customer P.O.',
    notes: 'Notes',
  });

  protected readonly violations: Signal<string[]> = computed(() => [
    ...this.formViolations(),
    ...(this.lines().length === 0 ? ['At least one line item is required'] : []),
  ]);

  protected readonly lineForm = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    // Phase 3 / WU-23 (F8-broad): fractional UoM-aware quantities accepted.
    quantity: new FormControl<number>(1, [
      Validators.required, Validators.min(0.0001),
      maxDecimalsValidator(UNIT_DECIMALS, this.translate.instant('quotes.qty'), this.translate),
    ]),
    unitPrice: new FormControl<number>(0, [
      Validators.required, Validators.min(0),
      maxDecimalsValidator(UNIT_DECIMALS, this.translate.instant('common.price'), this.translate),
    ]),
  });

  protected readonly taxRateValue = signal<number>(this.form.controls.taxRate.value ?? 0);

  protected readonly lineTotal = computed(() =>
    roundMoney(this.lines().reduce((sum, l) => sum + this.lineAmount(l), 0)));
  protected readonly freightTotal = computed(() =>
    roundMoney(this.lines().filter(l => l.lineType === 'Freight').reduce((sum, l) => sum + this.lineAmount(l), 0)));
  protected readonly itemsTotal = computed(() => roundMoney(this.lineTotal() - this.freightTotal()));
  protected readonly taxAmount = computed(() => roundMoney(this.itemsTotal() * (this.taxRateValue() ?? 0) / 100));

  protected readonly freightForm = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
  });
  protected readonly grandTotal = computed(() => roundMoney(this.lineTotal() + this.taxAmount()));

  protected lineAmount(line: LineEntry): number {
    return roundMoney(line.quantity * line.unitPrice);
  }

  protected readonly draftConfig: DraftConfig = {
    entityType: 'quote',
    entityId: 'new',
    route: '/quotes',
    snapshotFn: () => ({ ...this.form.getRawValue(), customerName: this.customerName(), lines: this.lines() }),
    restoreFn: (data) => {
      const customerId = typeof data['customerId'] === 'number' ? data['customerId'] : null;
      const customerName = typeof data['customerName'] === 'string' ? data['customerName'] : '';
      if (customerId != null && customerName) {
        this.customerName.set(customerName);
        this.customerPicker?.setSelected(customerId, customerName);
      }
      this.form.patchValue(data);
      if (Array.isArray(data['lines'])) this.lines.set(data['lines'] as LineEntry[]);
      this.form.markAsDirty();
    },
  };

  constructor() {
    // Auto-fill tax rate from customer's state when customer is selected
    this.form.controls.customerId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((customerId) => {
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
      this.defaultTaxPercent.set(0);
      this.customerPicked.set(customerId != null);
      this.taxEditability.set(null);
      this.creditStatus.set(null);
      this.form.controls.taxRate.enable({ emitEvent: false });
      if (customerId == null) return;
      if (this.auth.hasAnyRole(CUSTOMER_COMMERCIAL_TERMS_ROLES)) {
        this.customerService.getCreditStatus(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (status) => {
            if (this.form.controls.customerId.value === customerId) this.creditStatus.set(status);
          },
        });
      }
      this.adminService.getTaxRateForCustomer(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rate) => {
          if (rate == null) return;
          const pct = +(rate.rate * 100).toFixed(4);
          this.defaultTaxPercent.set(pct);
          this.form.controls.taxRate.setValue(pct, { emitEvent: false });
          this.taxRateValue.set(pct);
          this.taxAutoFilled.set(true);
          this.taxAutoLabel.set(
            rate.stateCode ? `${rate.stateCode} ${pct}%` : this.translate.instant('quotes.taxAutoDefault', { rate: pct })
          );
        },
      });
      this.customerService.getTaxEditability(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (editability) => {
          this.taxEditability.set(editability);
          if (!editability.canEditTax) {
            this.form.controls.taxRate.disable({ emitEvent: false });
          }
        },
      });
    });

    // When tax rate is manually changed, clear the auto-fill indicator
    this.form.controls.taxRate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.taxRateValue.set(value ?? 0);
      this.taxAutoFilled.set(false);
      this.taxAutoLabel.set('');
    });

    this.form.controls.taxOverrideReason.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() =>
      syncTaxOverrideValidators(this.form.controls.taxOverrideReason, this.form.controls.taxOverrideNote, this.taxOverridden()));

    effect(() => {
      syncTaxOverrideValidators(this.form.controls.taxOverrideReason, this.form.controls.taxOverrideNote, this.taxOverridden());
      this.form.updateValueAndValidity({ emitEvent: false });
    });

    this.lineForm.controls.partId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((partId) => {
      if (partId == null) this.onPartPicked(null);
    });

    // When price is manually changed, clear the "list price" indicator
    this.lineForm.controls.unitPrice.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.priceIsDefault.set(false);
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onCustomerSelected(customer: Record<string, unknown> | null): void {
    const currencyId = customer?.['currencyId'];
    this.customerCurrencyId.set(typeof currencyId === 'number' ? currencyId : null);
    this.customerName.set(customer ? String(customer['name'] ?? '') : '');
  }

  protected onPartPicked(row: Record<string, unknown> | null): void {
    const part = row as PartListItem | null;
    this.selectedPart.set(part);
    if (part == null) {
      this.priceIsDefault.set(false);
      return;
    }
    // Use the resolver-supplied effective price. When source is "Default" the
    // resolver returned 0 (no pricing configured) — don't pre-fill in that case.
    if (part && part.effectivePriceSource !== 'Default' && part.effectivePrice > 0) {
      this.lineForm.controls.unitPrice.setValue(part.effectivePrice, { emitEvent: false });
      this.priceIsDefault.set(true);
    } else {
      this.priceIsDefault.set(false);
    }
  }

  protected addLine(): void {
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
    this.priceIsDefault.set(false);
  }

  protected addFreight(): void {
    if (this.freightForm.invalid) return;
    this.lines.update(prev => [...prev, {
      partId: null,
      partNumber: '',
      description: this.translate.instant('freight.defaultDescription'),
      quantity: 1,
      unitPrice: Number(this.freightForm.controls.amount.value ?? 0),
      lineType: 'Freight',
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
    const taxRateDecimal = (f.taxRate ?? 0) / 100;
    const lineRequests: CreateQuoteLineRequest[] = this.lines().map(l => l.lineType === 'Freight'
      ? { description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, lineType: 'Freight' }
      : { partId: l.partId ?? undefined, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice });

    this.quoteService.createQuote({
      customerId: f.customerId!,
      quoteNumber: this.allowManualQuoteNumbers() ? (f.quoteNumber?.trim() || undefined) : undefined,
      expirationDate: f.expirationDate ? toIsoDate(f.expirationDate)! : undefined,
      taxRate: taxRateDecimal,
      ...taxOverridePayload(this.taxOverridden(), f.taxOverrideReason, f.taxOverrideNote),
      customerPO: f.customerPO || undefined,
      notes: f.notes || undefined,
      currencyId: this.documentCurrency()?.visible() ? (f.currencyId ?? undefined) : undefined,
      fxRate: this.documentCurrency()?.visible() && this.documentCurrency()?.isForeign() ? f.fxRate : undefined,
      lines: lineRequests,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.snackbar.success(this.translate.instant('quotes.quoteCreated'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
