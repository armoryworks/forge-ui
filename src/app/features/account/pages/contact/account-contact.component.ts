import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { AddressFormComponent } from '../../../../shared/components/address-form/address-form.component';
import { Address } from '../../../../shared/models/address.model';
import { toAddress, fromAddressToProfile } from '../../../../shared/utils/address.utils';
import { phoneValidator } from '../../../../shared/validators/phone.validator';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmployeeProfileService } from '../../services/employee-profile.service';

@Component({
  selector: 'app-account-contact',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, AddressFormComponent, ValidationPopoverDirective],
  templateUrl: './account-contact.component.html',
  styleUrl: './account-contact.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountContactComponent implements OnInit {
  private readonly profileService = inject(EmployeeProfileService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    phoneNumber: new FormControl<string | null>(null, [phoneValidator]),
    personalEmail: new FormControl<string | null>(null, [Validators.email, Validators.maxLength(200)]),
    address: new FormControl<Address | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    phoneNumber: 'Phone Number',
    personalEmail: 'Personal Email',
  });

  ngOnInit(): void {
    const p = this.profileService.profile();
    if (p) {
      this.form.patchValue({
        phoneNumber: p.phoneNumber,
        personalEmail: p.personalEmail,
        address: toAddress({ street1: p.street1, street2: p.street2, city: p.city, state: p.state, zipCode: p.zipCode, country: p.country }),
      });
    }
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const val = this.form.getRawValue();
    const addr = val.address;
    const current = this.profileService.profile();
    this.saving.set(true);

    this.profileService.updateProfile({
      dateOfBirth: current?.dateOfBirth ?? null,
      gender: current?.gender ?? null,
      ...fromAddressToProfile(addr),
      phoneNumber: val.phoneNumber,
      personalEmail: val.personalEmail,
      emergencyContactName: current?.emergencyContactName ?? null,
      emergencyContactPhone: current?.emergencyContactPhone ?? null,
      emergencyContactRelationship: current?.emergencyContactRelationship ?? null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('account.contactInfoUpdated'));
      },
      error: () => this.saving.set(false),
    });
  }
}
