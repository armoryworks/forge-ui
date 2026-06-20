import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ShipmentService } from '../../services/shipment.service';
import { ShipmentDetail } from '../../models/shipment-detail.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerAddressService } from '../../../../shared/services/customer-address.service';
import { CustomerAddress } from '../../../../shared/models/customer-address.model';
import { Address } from '../../../../shared/models/address.model';

/** Sentinel shipTo value that reveals the inline "add a new address" form. */
const ADD_NEW = -1;

/**
 * Corrects/adjusts a shipment's details — ship-to address (pick one of the customer's saved
 * addresses or enter a new one), tracking #, shipping cost, weight, notes. Every change is audited
 * server-side (rollup ActivityLog row on the shipment). Used to fix shipments that were created
 * without a ship-to address, and to amend details after the fact.
 */
@Component({
  selector: 'app-edit-shipment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    CurrencyInputComponent, AddressFormComponent, ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './edit-shipment-dialog.component.html',
  styleUrl: './edit-shipment-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditShipmentDialogComponent implements OnInit {
  private readonly shipmentService = inject(ShipmentService);
  private readonly customerAddressService = inject(CustomerAddressService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly shipment = input.required<ShipmentDetail>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly ADD_NEW = ADD_NEW;
  protected readonly addresses = signal<CustomerAddress[]>([]);
  protected readonly loadingAddresses = signal(true);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    shipTo: new FormControl<number | null>(null, { validators: [Validators.required] }),
    trackingNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    shippingCost: new FormControl<number | null>(null),
    weight: new FormControl<number | null>(null),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    newLabel: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    newType: new FormControl<string>('Shipping', { nonNullable: true }),
    newAddress: new FormControl<Address | null>(null),
    newDefault: new FormControl<boolean>(false, { nonNullable: true }),
  });

  protected readonly addressTypeOptions: SelectOption[] = [
    { value: 'Shipping', label: this.translate.instant('shipments.edit.typeShipping') },
    { value: 'Both', label: this.translate.instant('shipments.edit.typeBoth') },
  ];

  protected readonly shipToOptions = computed<SelectOption[]>(() => {
    const opts: SelectOption[] = this.addresses().map(a => ({
      value: a.id,
      label: `${a.label} — ${a.line1}, ${a.city} ${a.state} ${a.postalCode}`.trim(),
    }));
    opts.push({ value: ADD_NEW, label: this.translate.instant('shipments.edit.addNewAddress') });
    return opts;
  });

  protected readonly addingNew = signal(false);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    shipTo: this.translate.instant('shipments.edit.shipTo'),
    newLabel: this.translate.instant('shipments.edit.addressLabel'),
    newAddress: this.translate.instant('shipments.edit.newAddress'),
  });

  constructor() {
    // Toggle the inline-new-address validators only when "add new" is selected.
    this.form.controls.shipTo.valueChanges.pipe(takeUntilDestroyed()).subscribe(v => {
      const adding = v === ADD_NEW;
      this.addingNew.set(adding);
      const { newLabel, newAddress } = this.form.controls;
      if (adding) {
        newLabel.addValidators(Validators.required);
        newAddress.addValidators(EditShipmentDialogComponent.addressComplete);
      } else {
        newLabel.removeValidators(Validators.required);
        newAddress.removeValidators(EditShipmentDialogComponent.addressComplete);
      }
      newLabel.updateValueAndValidity();
      newAddress.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    const s = this.shipment();
    this.form.patchValue({
      shipTo: s.shippingAddressId,
      trackingNumber: s.trackingNumber ?? '',
      shippingCost: s.shippingCost,
      weight: s.weight,
      notes: s.notes ?? '',
    });
    this.loadAddresses();
  }

  private loadAddresses(): void {
    this.loadingAddresses.set(true);
    this.customerAddressService.list(this.shipment().customerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: rows => {
          this.addresses.set(rows.filter(a => a.addressType === 'Shipping' || a.addressType === 'Both'));
          // No saved shipping address to pick → drop straight into "add new".
          if (this.addresses().length === 0) this.form.controls.shipTo.setValue(ADD_NEW);
          this.loadingAddresses.set(false);
        },
        error: () => this.loadingAddresses.set(false),
      });
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    if (this.form.controls.shipTo.value === ADD_NEW) {
      const a = this.form.controls.newAddress.value!;
      this.customerAddressService.create(this.shipment().customerId, {
        label: this.form.controls.newLabel.value.trim() || this.translate.instant('shipments.edit.defaultLabel'),
        addressType: this.form.controls.newType.value,
        line1: a.line1.trim(),
        line2: a.line2?.trim() || null,
        city: a.city.trim(),
        state: a.state.trim(),
        postalCode: a.postalCode.trim(),
        country: a.country?.trim() || 'US',
        isDefault: this.form.controls.newDefault.value,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: created => this.persist(created.id),
        error: () => this.saving.set(false),
      });
    } else {
      this.persist(this.form.controls.shipTo.value!);
    }
  }

  private persist(addressId: number): void {
    const v = this.form.getRawValue();
    this.shipmentService.updateShipment(this.shipment().id, {
      shippingAddressId: addressId,
      trackingNumber: v.trackingNumber.trim(),
      shippingCost: v.shippingCost ?? undefined,
      weight: v.weight ?? undefined,
      notes: v.notes.trim(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('shipments.edit.saved'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  /** The AddressForm CVA doesn't propagate validity, so gate on the required address parts here. */
  private static addressComplete(ctrl: AbstractControl): ValidationErrors | null {
    const a = ctrl.value as Address | null;
    if (!a) return { required: true };
    return a.line1?.trim() && a.city?.trim() && a.state?.trim() && a.postalCode?.trim()
      ? null
      : { incomplete: true };
  }
}
