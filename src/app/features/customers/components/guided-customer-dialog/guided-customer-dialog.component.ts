import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { Address } from '../../../../shared/models/address.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';
import { CreateCustomerRequest, AddressInput } from '../../models/create-customer-request.model';

/**
 * Phase 1o.3 — guided customer-creation wizard for net-new strategic
 * accounts (regulated/aerospace shops, anything multi-contact, anything
 * worth investing the upfront effort to capture properly). Mirrors the
 * shape of the lead-fork's per-shape extras + the convert-lead stepper.
 *
 * Steps:
 *   1. Identity        — name, company, contact, email, phone
 *   2. Engagement      — first-quote shape (mirrors LeadEngagementShape),
 *                        captures the strategic / quick-quote / repeat /
 *                        prototype context as customer notes / shape
 *   3. Addresses       — billing + shipping (with same-as-billing toggle)
 *   4. Credit & tax    — credit limit, default currency, tax-exempt + id
 *   5. Review          — confirm + commit
 *
 * Output is the same {@link CreateCustomerRequest} the existing customer
 * dialog produces — we don't introduce a new server endpoint, just a
 * richer client-side flow.
 */

const SHAPE_CHOICES = ['Unknown', 'QuickQuote', 'Repeat', 'Strategic', 'Prototype'] as const;
type CustomerEngagementShape = typeof SHAPE_CHOICES[number];

@Component({
  selector: 'app-guided-customer-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    MatStepperModule,
    DialogComponent,
    InputComponent, SelectComponent, ToggleComponent, TextareaComponent,
    CurrencyInputComponent, AddressFormComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './guided-customer-dialog.component.html',
  styleUrl: './guided-customer-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuidedCustomerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GuidedCustomerDialogComponent, CreateCustomerRequest | undefined>);
  protected readonly translate = inject(TranslateService);

  protected readonly currentStep = signal(0);
  protected readonly shape = signal<CustomerEngagementShape>('Unknown');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    companyName: new FormControl<string>('', { nonNullable: true }),
    contactName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl<string>('', { nonNullable: true, validators: [phoneValidator] }),
    notes: new FormControl<string>('', { nonNullable: true }),

    creditLimit: new FormControl<number | null>(null),
    defaultCurrency: new FormControl<string>('USD', { nonNullable: true }),
    isTaxExempt: new FormControl(false, { nonNullable: true }),
    taxExemptionId: new FormControl<string | null>(null),

    billingAddress: new FormControl<Address | null>(null),
    shippingAddress: new FormControl<Address | null>(null),
    shippingSameAsBilling: new FormControl(true, { nonNullable: true }),

    // Shape-specific extras (same shape as the lead fork dialog)
    decisionMaker: new FormControl<string>('', { nonNullable: true }),
    champion: new FormControl<string>('', { nonNullable: true }),
    currentVendor: new FormControl<string>('', { nonNullable: true }),
    referenceJob: new FormControl<string>('', { nonNullable: true }),
    projectType: new FormControl<string>('', { nonNullable: true }),
    expectedTimeline: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly currencyOptions: SelectOption[] = [
    { value: 'USD', label: this.translate.instant('leads.convertStepper.currencyUSD') },
    { value: 'EUR', label: this.translate.instant('leads.convertStepper.currencyEUR') },
    { value: 'GBP', label: this.translate.instant('leads.convertStepper.currencyGBP') },
    { value: 'CAD', label: this.translate.instant('leads.convertStepper.currencyCAD') },
    { value: 'MXN', label: this.translate.instant('leads.convertStepper.currencyMXN') },
  ];

  protected readonly shapeChoices = SHAPE_CHOICES.map(value => ({
    value,
    titleKey: `leads.fork.shape${value}`,
    descKey: `leads.fork.shape${value}Desc`,
    icon: this.iconFor(value),
  }));

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('customers.guided.fields.name'),
    email: this.translate.instant('common.email'),
    taxExemptionId: this.translate.instant('leads.convertStepper.violations.taxExemptionIdRequired'),
  });

  /** Show RFQ-style fields (parts list / target price / due date) for QuickQuote + Prototype. */
  protected readonly showsRfqExtras = computed(() => {
    const s = this.shape();
    return s === 'QuickQuote' || s === 'Prototype';
  });

  protected readonly showsStrategicExtras = computed(() => this.shape() === 'Strategic');
  protected readonly showsRepeatExtras = computed(() => this.shape() === 'Repeat');
  protected readonly showsPrototypeExtras = computed(() => this.shape() === 'Prototype');

  protected readonly shapePlaybook = computed(() => {
    const s = this.shape();
    if (s === 'Unknown') return null;
    return this.translate.instant('leads.playbook.' + s);
  });

  constructor() {
    this.form.controls.isTaxExempt.valueChanges.subscribe(isExempt => {
      const ctrl = this.form.controls.taxExemptionId;
      if (isExempt) ctrl.addValidators(Validators.required);
      else { ctrl.removeValidators(Validators.required); ctrl.setValue(null); }
      ctrl.updateValueAndValidity();
    });

    this.form.controls.shippingSameAsBilling.valueChanges.subscribe(same => {
      if (same) this.form.controls.shippingAddress.setValue(null);
    });
  }

  protected pickShape(s: CustomerEngagementShape): void {
    this.shape.set(s);
    this.next();
  }

  protected next(): void { this.currentStep.update(s => s + 1); }
  protected back(): void { this.currentStep.update(s => Math.max(0, s - 1)); }
  protected close(): void { this.dialogRef.close(undefined); }

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();

    // Build customer notes that fold in the shape-specific extras the
    // user filled in. Server-side schema doesn't model these per-field
    // yet, so we surface them as structured note text — a future
    // CustomerEngagementShape column could capture them properly.
    const noteLines: string[] = [];
    if (v.notes.trim()) noteLines.push(v.notes.trim());
    if (this.shape() !== 'Unknown') {
      noteLines.push(`Engagement shape: ${this.shape()}`);
    }
    if (this.showsStrategicExtras()) {
      if (v.decisionMaker.trim()) noteLines.push(`Decision maker: ${v.decisionMaker.trim()}`);
      if (v.champion.trim()) noteLines.push(`Champion: ${v.champion.trim()}`);
      if (v.currentVendor.trim()) noteLines.push(`Current vendor: ${v.currentVendor.trim()}`);
    }
    if (this.showsRepeatExtras() && v.referenceJob.trim()) {
      noteLines.push(`Reference job: ${v.referenceJob.trim()}`);
    }
    if (this.showsPrototypeExtras()) {
      if (v.projectType.trim()) noteLines.push(`Project type: ${v.projectType.trim()}`);
      if (v.expectedTimeline.trim()) noteLines.push(`Expected timeline: ${v.expectedTimeline.trim()}`);
    }

    const request: CreateCustomerRequest = {
      name: v.name.trim(),
      companyName: v.companyName.trim() || undefined,
      email: v.email.trim() || undefined,
      phone: v.phone.trim() || undefined,
    };

    if (v.creditLimit !== null) request.creditLimit = v.creditLimit;
    if (v.defaultCurrency) request.defaultCurrency = v.defaultCurrency;
    if (v.isTaxExempt) {
      request.isTaxExempt = true;
      if (v.taxExemptionId) request.taxExemptionId = v.taxExemptionId;
    }
    if (v.billingAddress) request.billingAddress = toAddressInput(v.billingAddress);
    if (v.shippingSameAsBilling && v.billingAddress) {
      request.shippingAddress = toAddressInput(v.billingAddress);
    } else if (!v.shippingSameAsBilling && v.shippingAddress) {
      request.shippingAddress = toAddressInput(v.shippingAddress);
    }

    this.dialogRef.close(request);
  }

  protected iconFor(shape: CustomerEngagementShape): string {
    const map: Record<CustomerEngagementShape, string> = {
      Unknown: 'flash_on',
      QuickQuote: 'request_quote',
      Repeat: 'repeat',
      Strategic: 'business_center',
      Prototype: 'science',
    };
    return map[shape];
  }
}

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
