import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CompanyLocation } from '../../models/company-location.model';
import { Address } from '../../../../shared/models/address.model';

@Component({
  selector: 'app-company-location-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, DialogComponent, InputComponent, ToggleComponent,
    AddressFormComponent, ValidationPopoverDirective,
  ],
  templateUrl: './company-location-dialog.component.html',
  styleUrl: './company-location-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyLocationDialogComponent {
  readonly location = input<CompanyLocation | null>(null);
  readonly saving = input(false);
  readonly closed = output<void>();
  readonly saved = output<Partial<CompanyLocation>>();

  protected readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    phone: new FormControl(''),
    isActive: new FormControl(true),
    address: new FormControl<Address | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Location Name',
  });

  protected readonly isEdit = signal(false);

  constructor() {
    const loc = this.location();
    if (loc) {
      this.isEdit.set(true);
      this.form.patchValue({
        name: loc.name,
        phone: loc.phone ?? '',
        isActive: loc.isActive,
        address: {
          line1: loc.line1,
          line2: loc.line2 ?? undefined,
          city: loc.city,
          state: loc.state,
          postalCode: loc.postalCode,
          country: loc.country,
        },
      });
    }
  }

  protected save(): void {
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    const addr = v.address;

    this.saved.emit({
      name: v.name!,
      phone: v.phone || null,
      isActive: v.isActive!,
      line1: addr?.line1 ?? '',
      line2: addr?.line2 ?? null,
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      postalCode: addr?.postalCode ?? '',
      country: addr?.country ?? 'US',
    });
  }
}
