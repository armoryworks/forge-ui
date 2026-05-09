import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { Address } from '../../../../shared/models/address.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { LeadItem } from '../../models/lead-item.model';
import { ConvertLeadRequest } from '../../models/convert-lead-request.model';
import { AddressInput } from '../../../customers/models/create-customer-request.model';

export interface LeadConvertDialogData {
  lead: LeadItem;
}

/**
 * Wave 2 — convert-lead stepper. Replaces the prior single-confirm dialog
 * with a 3-step flow that mirrors the Parts new-part fork in spirit:
 *   Step 1 — what carries over from the lead (read-only summary)
 *   Step 2 — customer-required fields the lead doesn't capture
 *           (credit limit, tax exemption, currency, addresses, create-job)
 *   Step 3 — confirm + commit
 *
 * All Step 2 fields are optional. The user may click through with no
 * input and end up at the prior minimal-customer behavior; the value of
 * the stepper is that an engaged user has a structured place to put the
 * customer-shape data instead of needing to chase the customer detail
 * page after conversion.
 */
@Component({
  selector: 'app-lead-convert-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    MatStepperModule,
    DialogComponent,
    InputComponent, SelectComponent, ToggleComponent,
    CurrencyInputComponent, AddressFormComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './lead-convert-dialog.component.html',
  styleUrl: './lead-convert-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadConvertDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<LeadConvertDialogComponent, ConvertLeadRequest | undefined>);
  protected readonly translate = inject(TranslateService);
  protected readonly data = inject<LeadConvertDialogData>(MAT_DIALOG_DATA);

  protected readonly lead = this.data.lead;
  protected readonly currentStep = signal(0);

  /**
   * Phase 1o.1 — parse the lead's CustomFieldValues JSON so step 1 can
   * surface the shape-specific extras the rep captured at lead-creation
   * (decisionMaker for Strategic, referenceJob for Repeat, etc.).
   * Empty record when the lead has no extras.
   */
  protected readonly leadExtras = computed<Record<string, string>>(() => {
    if (!this.lead.customFieldValues) return {};
    try {
      const parsed = JSON.parse(this.lead.customFieldValues);
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, string> : {};
    } catch {
      return {};
    }
  });

  /**
   * Phase 1o.1 — shape-keyed playbook hint surfaced as a banner at the
   * top of step 2. Mirrors the per-shape playbooks rendered on the lead
   * detail panel (phase 1j.3) so the same guidance carries through the
   * conversion that lived on the lead.
   */
  protected readonly shapePlaybook = computed(() => {
    const shape = this.lead.engagementShape;
    if (!shape || shape === 'Unknown') return null;
    return this.translate.instant('leads.playbook.' + shape);
  });

  /**
   * Map a shape to its Material icon. Mirrors the mapping in
   * lead-detail-panel.component.ts so the same visual cue carries.
   */
  protected getShapeIcon(): string {
    const map: Record<string, string> = {
      QuickQuote: 'request_quote',
      Repeat: 'repeat',
      Strategic: 'business_center',
      Prototype: 'science',
      Unknown: 'flash_on',
    };
    return map[this.lead.engagementShape ?? 'Unknown'] ?? 'flag';
  }

  protected readonly form = new FormGroup({
    creditLimit: new FormControl<number | null>(null),
    isTaxExempt: new FormControl(false, { nonNullable: true }),
    taxExemptionId: new FormControl<string | null>(null),
    defaultCurrency: new FormControl<string>('USD', { nonNullable: true }),
    billingAddress: new FormControl<Address | null>(null),
    shippingAddress: new FormControl<Address | null>(null),
    shippingSameAsBilling: new FormControl(true, { nonNullable: true }),
    createJob: new FormControl(false, { nonNullable: true }),
  });

  protected readonly currencyOptions: SelectOption[] = [
    { value: 'USD', label: this.translate.instant('leads.convertStepper.currencyUSD') },
    { value: 'EUR', label: this.translate.instant('leads.convertStepper.currencyEUR') },
    { value: 'GBP', label: this.translate.instant('leads.convertStepper.currencyGBP') },
    { value: 'CAD', label: this.translate.instant('leads.convertStepper.currencyCAD') },
    { value: 'MXN', label: this.translate.instant('leads.convertStepper.currencyMXN') },
  ];

  // Cross-field rule: tax-exempt requires the certificate id. Step 2 won't
  // block forward navigation on this (the form is intentionally permissive)
  // but the validation-button on step 3's Convert action surfaces it so the
  // user can't commit a half-filled exemption pair.
  protected readonly violations = FormValidationService.getViolations(this.form, {
    taxExemptionId: this.translate.instant('leads.convertStepper.violations.taxExemptionIdRequired'),
  });

  // Did the user fill in any optional details? Used by step 3 to either
  // show the review block or a "skipped — fill later" hint.
  protected readonly hasCustomerDetails = computed(() => {
    const v = this.form.getRawValue();
    return v.creditLimit !== null
      || v.isTaxExempt
      || !!v.billingAddress
      || (!v.shippingSameAsBilling && !!v.shippingAddress);
  });

  constructor() {
    // Tax-exempt → exemption id required (mirrors CreateCustomer rule).
    this.form.controls.isTaxExempt.valueChanges.subscribe(isExempt => {
      const ctrl = this.form.controls.taxExemptionId;
      if (isExempt) {
        ctrl.addValidators(Validators.required);
      } else {
        ctrl.removeValidators(Validators.required);
        ctrl.setValue(null);
      }
      ctrl.updateValueAndValidity();
    });

    // "Same as billing" → keep shipping in sync with billing while toggled
    // on. When toggled off the user gets an empty shipping form to fill.
    this.form.controls.shippingSameAsBilling.valueChanges.subscribe(same => {
      if (same) {
        this.form.controls.shippingAddress.setValue(null);
      }
    });
  }

  protected next(): void { this.currentStep.update(s => s + 1); }
  protected back(): void { this.currentStep.update(s => Math.max(0, s - 1)); }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    const request: ConvertLeadRequest = {
      createJob: v.createJob,
    };

    if (v.creditLimit !== null) request.creditLimit = v.creditLimit;
    if (v.isTaxExempt) {
      request.isTaxExempt = true;
      if (v.taxExemptionId) request.taxExemptionId = v.taxExemptionId;
    }
    if (v.defaultCurrency && v.defaultCurrency !== 'USD') {
      // Send only when user explicitly picked a non-default. Prevents bias
      // toward USD on installs whose tenant default differs.
      request.defaultCurrency = v.defaultCurrency;
    } else if (v.defaultCurrency) {
      request.defaultCurrency = v.defaultCurrency;
    }

    if (v.billingAddress) request.billingAddress = toAddressInput(v.billingAddress);

    // Shipping: either user filled it explicitly, or it mirrors billing
    // (default behavior). Only send if billing exists in the latter case.
    if (v.shippingSameAsBilling && v.billingAddress) {
      request.shippingAddress = toAddressInput(v.billingAddress);
    } else if (!v.shippingSameAsBilling && v.shippingAddress) {
      request.shippingAddress = toAddressInput(v.shippingAddress);
    }

    this.dialogRef.close(request);
  }
}

/**
 * Maps the AddressFormComponent's Address shape (line1/postalCode) to the
 * server's AddressInput contract (street/postal). Local helper kept inline
 * because the rest of the codebase uses Address directly; this is the
 * one place we cross the contract boundary.
 */
function toAddressInput(addr: Address): AddressInput {
  return {
    street: addr.line1 ?? '',
    line2: addr.line2 ?? undefined,
    city: addr.city ?? '',
    state: addr.state ?? '',
    postal: addr.postalCode ?? '',
    country: addr.country ?? 'US',
  };
}
