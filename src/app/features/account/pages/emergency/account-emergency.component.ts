import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent } from '../../../../shared/components/select/select.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { phoneValidator } from '../../../../shared/validators/phone.validator';
import { EmployeeProfileService } from '../../services/employee-profile.service';

// Relationship options are initialized in constructor to support i18n

@Component({
  selector: 'app-account-emergency',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, SelectComponent, ValidationPopoverDirective],
  templateUrl: './account-emergency.component.html',
  styleUrl: './account-emergency.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountEmergencyComponent implements OnInit {
  private readonly profileService = inject(EmployeeProfileService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly saving = signal(false);
  protected readonly relationshipOptions = [
    { value: null, label: this.translate.instant('account.relationshipSelect') },
    { value: 'Spouse', label: this.translate.instant('account.relationshipSpouse') },
    { value: 'Parent', label: this.translate.instant('account.relationshipParent') },
    { value: 'Sibling', label: this.translate.instant('account.relationshipSibling') },
    { value: 'Child', label: this.translate.instant('account.relationshipChild') },
    { value: 'Friend', label: this.translate.instant('account.relationshipFriend') },
    { value: 'Other', label: this.translate.instant('account.relationshipOther') },
  ];

  protected readonly form = new FormGroup({
    emergencyContactName: new FormControl<string | null>(null, [Validators.required, Validators.maxLength(200)]),
    emergencyContactPhone: new FormControl<string | null>(null, [Validators.required, phoneValidator]),
    emergencyContactRelationship: new FormControl<string | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    emergencyContactName: 'Contact Name',
    emergencyContactPhone: 'Contact Phone',
  });

  ngOnInit(): void {
    const p = this.profileService.profile();
    if (p) {
      this.form.patchValue({
        emergencyContactName: p.emergencyContactName,
        emergencyContactPhone: p.emergencyContactPhone,
        emergencyContactRelationship: p.emergencyContactRelationship,
      });
    }
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const val = this.form.getRawValue();
    const current = this.profileService.profile();
    this.saving.set(true);

    this.profileService.updateProfile({
      dateOfBirth: current?.dateOfBirth ?? null,
      gender: current?.gender ?? null,
      street1: current?.street1 ?? null,
      street2: current?.street2 ?? null,
      city: current?.city ?? null,
      state: current?.state ?? null,
      zipCode: current?.zipCode ?? null,
      country: current?.country ?? null,
      phoneNumber: current?.phoneNumber ?? null,
      personalEmail: current?.personalEmail ?? null,
      emergencyContactName: val.emergencyContactName,
      emergencyContactPhone: val.emergencyContactPhone,
      emergencyContactRelationship: val.emergencyContactRelationship,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('account.emergencyContactUpdated'));
      },
      error: () => this.saving.set(false),
    });
  }
}
