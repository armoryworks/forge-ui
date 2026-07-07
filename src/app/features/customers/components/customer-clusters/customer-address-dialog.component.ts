import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { Address } from '../../../../shared/models/address.model';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { CreateCustomerAddressRequest } from '../../../../shared/models/create-customer-address-request.model';
import { UpdateCustomerAddressRequest } from '../../../../shared/models/update-customer-address-request.model';

import { CustomerAddressService } from '../../services/customer-address.service';

/**
 * Create/edit dialog for a customer's saved addresses. Opened by
 * CustomerAddressesClusterComponent — `address` null means create mode,
 * populated means edit mode.
 *
 * The street/city/state/zip/country block reuses the shared
 * AddressFormComponent (CVA). Because that component does not implement
 * `Validator`, its inner required-field state doesn't propagate to this
 * form's validity — `addressCompleteValidator` bridges the gap by
 * rejecting null or partially-filled Address values.
 *
 * Save is a single POST/PUT of the full payload (a future is_active
 * toggle slots in as one more form control on the same request).
 */
@Component({
  selector: 'app-customer-address-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    AddressFormComponent, ValidationButtonComponent,
  ],
  templateUrl: './customer-address-dialog.component.html',
  styleUrl: './customer-address-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressDialogComponent {
  private readonly addressService = inject(CustomerAddressService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();
  /** Null = create mode; populated = edit mode. */
  readonly address = input<CustomerAddress | null>(null);

  /** Emitted after a successful create/update — parent refreshes + closes. */
  readonly saved = output<void>();
  /** Emitted when the user dismisses without saving. */
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly title = computed(() =>
    this.translate.instant(this.address() ? 'customers.addresses.editAddress' : 'customers.addresses.addAddress'),
  );

  // AddressType is a fixed server enum (Billing/Shipping/Both), not
  // DB-driven reference data — a static option list is the sanctioned
  // exception (same shape as PRIORITY_OPTIONS).
  protected readonly typeOptions: SelectOption[] = [
    { value: 'Billing', label: this.translate.instant('customers.addresses.typeBilling') },
    { value: 'Shipping', label: this.translate.instant('customers.addresses.typeShipping') },
    { value: 'Both', label: this.translate.instant('customers.addresses.typeBoth') },
  ];

  protected readonly form = new FormGroup({
    label: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    addressType: new FormControl<string>('Billing', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl<Address | null>(null, [Validators.required, CustomerAddressDialogComponent.addressCompleteValidator]),
    isDefault: new FormControl<boolean>(false, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    label: this.translate.instant('customers.addresses.labelField'),
    addressType: this.translate.instant('customers.addresses.typeField'),
    address: this.translate.instant('common.address'),
  });

  constructor() {
    // Hydrate once in edit mode. The cluster mounts this component fresh
    // per open (@if), so the input is effectively set-once.
    effect(() => {
      const addr = this.address();
      if (!addr) return;
      this.form.patchValue({
        label: addr.label,
        addressType: addr.addressType,
        address: {
          line1: addr.line1,
          line2: addr.line2 ?? null,
          city: addr.city,
          state: addr.state,
          postalCode: addr.postalCode,
          country: addr.country,
        },
        isDefault: addr.isDefault,
      });
    });
  }

  /**
   * AddressFormComponent emits a non-null Address as soon as ANY field has
   * a value, with '' for the rest — reject those partials so form.invalid
   * reflects the server's NotEmpty rules on line1/city/state/postalCode/country.
   */
  static addressCompleteValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as Address | null;
    if (!value) return null; // null is handled by Validators.required
    const complete = !!(value.line1 && value.city && value.state && value.postalCode && value.country);
    return complete ? null : { addressIncomplete: true };
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const addr = v.address!;
    // Create and Update payloads are shape-identical today; keep the save a
    // single PUT/POST of the whole record (no per-field patching).
    const payload: CreateCustomerAddressRequest & UpdateCustomerAddressRequest = {
      label: v.label,
      addressType: v.addressType,
      line1: addr.line1,
      line2: addr.line2 || null,
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      isDefault: v.isDefault,
    };

    this.saving.set(true);
    const existing = this.address();
    // Union of Observable<void> | Observable<CustomerAddress> isn't callable
    // via .subscribe — widen to unknown (we only care about completion).
    const obs: Observable<unknown> = existing
      ? this.addressService.updateAddress(this.customerId(), existing.id, payload)
      : this.addressService.createAddress(this.customerId(), payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('customers.addresses.addressSaved'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
