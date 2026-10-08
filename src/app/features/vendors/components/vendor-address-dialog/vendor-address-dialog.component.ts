import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { Address } from '../../../../shared/models/address.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { VendorAddress } from '../../models/vendor-address.model';
import { VendorAddressRequest } from '../../models/vendor-address-request.model';
import { VendorService } from '../../services/vendor.service';

export const VENDOR_ADDRESS_TYPES: readonly { value: string; labelKey: string }[] = [
  { value: 'RemitTo', labelKey: 'vendorContacts.addressTypes.remitTo' },
  { value: 'OrderFrom', labelKey: 'vendorContacts.addressTypes.orderFrom' },
  { value: 'ShipFrom', labelKey: 'vendorContacts.addressTypes.shipFrom' },
  { value: 'Billing', labelKey: 'vendorContacts.addressTypes.billing' },
  { value: 'Other', labelKey: 'vendorContacts.addressTypes.other' },
];

@Component({
  selector: 'app-vendor-address-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    AddressFormComponent, ValidationButtonComponent,
  ],
  templateUrl: './vendor-address-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorAddressDialogComponent {
  private readonly vendorService = inject(VendorService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly vendorId = input.required<number>();
  readonly address = input<VendorAddress | null>(null);

  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly title = computed(() =>
    this.translate.instant(this.address() ? 'vendorContacts.addressDialog.editTitle' : 'vendorContacts.addressDialog.addTitle'),
  );

  protected readonly typeOptions: SelectOption[] = VENDOR_ADDRESS_TYPES.map(t => ({
    value: t.value,
    label: this.translate.instant(t.labelKey),
  }));

  protected readonly form = new FormGroup({
    addressType: new FormControl('RemitTo', { nonNullable: true, validators: [Validators.required] }),
    label: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    address: new FormControl<Address | null>(null, [Validators.required, VendorAddressDialogComponent.addressComplete]),
    isDefault: new FormControl(false, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    addressType: this.translate.instant('vendorContacts.addressDialog.type'),
    label: this.translate.instant('vendorContacts.addressDialog.label'),
    address: this.translate.instant('common.address'),
  });

  constructor() {
    effect(() => {
      const a = this.address();
      if (!a) return;
      this.form.patchValue({
        addressType: a.addressType,
        label: a.label ?? '',
        address: {
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
        },
        isDefault: a.isDefault,
      });
    });
  }

  static addressComplete(control: AbstractControl): ValidationErrors | null {
    const value = control.value as Address | null;
    if (!value) return null;
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
    const payload: VendorAddressRequest = {
      addressType: v.addressType,
      label: v.label.trim() || null,
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
    const request: Observable<VendorAddress> = existing
      ? this.vendorService.updateAddress(this.vendorId(), existing.id, payload)
      : this.vendorService.createAddress(this.vendorId(), payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(existing ? 'vendorContacts.addressUpdated' : 'vendorContacts.addressAdded'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
