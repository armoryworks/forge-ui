import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DocumentCurrencyComponent } from '../../../../shared/components/document-currency/document-currency.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { PaymentTermsService } from '../../../../shared/services/payment-terms.service';
import { SalesTaxCodesService } from '../../../../shared/services/sales-tax-codes.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { FREIGHT_TERMS, FreightTerms } from '../../../../shared/models/freight-terms.const';
import { CustomerSummary } from '../../models/customer-summary.model';

/**
 * Pillar 5 — Customer identity & contact cluster.
 *
 * Renders read-only or edit form for the customer's identity fields:
 * Name, Company Name, Email, Phone, IsActive (status). External-system
 * fields (provider / externalId) are read-only when present.
 *
 * Used as the default `overview` tab on the Customer detail page across
 * every lifecycle (Active / Prospect / Archived).
 */
@Component({
  selector: 'app-customer-identity-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent, CurrencyInputComponent, CurrencyDisplayComponent, DocumentCurrencyComponent,
  ],
  templateUrl: './customer-identity-cluster.component.html',
  styleUrl: './customer-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerIdentityClusterComponent {
  private readonly translate = inject(TranslateService);
  private readonly manualNumberSettings = inject(ManualNumberSettingsService);
  private readonly paymentTerms = inject(PaymentTermsService).ensureLoaded();
  private readonly capability = inject(CapabilityService);
  private readonly taxCodes = inject(SalesTaxCodesService);

  readonly customer = input.required<CustomerSummary>();
  readonly editing = input(false);
  readonly saving = input(false);
  readonly canEditCommercialTerms = input(false);
  readonly creditLimitsEnabled = input(false);

  readonly save = output<Partial<CustomerSummary>>();
  readonly cancelled = output<void>();
  protected readonly currencyId = computed(() => this.customer().currencyId ?? null);
  protected readonly currencyLocked = computed(() => this.customer().currencyLocked ?? false);

  /** Gated by the `customers.allow_manual_numbers` system setting. */
  protected readonly allowManualCustomerNumbers = computed(() => this.manualNumberSettings.isEnabled('customers'));
  protected readonly creditTermsOptions = this.paymentTerms.options;
  protected readonly canSeeTerms = this.paymentTerms.canRead;
  protected readonly taxCodesEnabled = computed(() => this.capability.isEnabled('CAP-MD-TAXCODES', true));
  protected readonly taxCodeOptions = this.taxCodes.options;
  protected readonly freightTermsOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('freight.terms.installDefault') },
    ...FREIGHT_TERMS.map(t => ({ value: t, label: this.translate.instant(`freight.terms.${t}`) })),
  ];

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    customerNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    companyName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(200)] }),
    phone: new FormControl<string>('', { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
    creditLimit: new FormControl<number | null>(null, [Validators.min(0), Validators.max(1_000_000_000)]),
    isTaxExempt: new FormControl<boolean>(false, { nonNullable: true }),
    taxExemptionId: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    paymentTermsId: new FormControl<number | null>(null),
    currencyId: new FormControl<number | null>(null),
    freightTerms: new FormControl<FreightTerms | null>(null),
    defaultTaxCodeId: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('customers.identityCluster.violations.name'),
    email: this.translate.instant('customers.identityCluster.violations.email'),
    creditLimit: this.translate.instant('customers.workflow.creditAndTax.creditLimitLabel'),
    taxExemptionId: this.translate.instant('customers.workflow.creditAndTax.taxExemptionIdLabel'),
  });

  constructor() {
    this.form.controls.isTaxExempt.valueChanges.pipe(takeUntilDestroyed()).subscribe(isExempt => {
      const ctrl = this.form.controls.taxExemptionId;
      if (isExempt) ctrl.addValidators(Validators.required);
      else ctrl.removeValidators(Validators.required);
      ctrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    });

    effect(() => {
      const c = this.customer();
      this.form.reset({
        name: c.name,
        customerNumber: c.customerNumber ?? '',
        companyName: c.companyName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        isActive: c.isActive,
        creditLimit: c.creditLimit ?? null,
        isTaxExempt: c.isTaxExempt ?? false,
        taxExemptionId: c.taxExemptionId ?? '',
        paymentTermsId: c.paymentTermsId ?? this.paymentTerms.forLegacy(c.defaultCreditTerms)?.id ?? null,
        currencyId: c.currencyId ?? null,
        freightTerms: c.freightTerms ?? null,
        defaultTaxCodeId: c.defaultTaxCodeId ?? null,
      });
      if (this.taxCodesEnabled()) this.taxCodes.ensureLoaded();
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const patch: Partial<CustomerSummary> = {
      name: v.name,
      customerNumber: this.allowManualCustomerNumbers() ? (v.customerNumber.trim() || undefined) : undefined,
      companyName: v.companyName || undefined,
      email: v.email.trim(),
      phone: v.phone.trim(),
      isActive: v.isActive,
    };
    if (this.canEditCommercialTerms()) {
      patch.isTaxExempt = v.isTaxExempt;
      patch.taxExemptionId = v.isTaxExempt ? v.taxExemptionId.trim() : '';
      if (this.creditLimitsEnabled()) patch.creditLimit = v.creditLimit;
      patch.paymentTermsId = v.paymentTermsId;
      if (this.taxCodesEnabled()) patch.defaultTaxCodeId = v.defaultTaxCodeId;
    }
    if (v.freightTerms !== (this.customer().freightTerms ?? null)) patch.freightTerms = v.freightTerms;
    if (!this.customer().currencyLocked && this.form.controls.currencyId.dirty && v.currencyId !== (this.customer().currencyId ?? null)) {
      patch.currencyId = v.currencyId;
    }
    this.save.emit(patch);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
