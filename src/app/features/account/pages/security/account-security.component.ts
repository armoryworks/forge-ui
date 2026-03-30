import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, ValidationPopoverDirective],
  templateUrl: './account-security.component.html',
  styleUrl: './account-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurityComponent {
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly user = this.authService.user;
  protected readonly savingPassword = signal(false);
  protected readonly savingPin = signal(false);

  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly pinForm = new FormGroup({
    pin: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)] }),
    confirmPin: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly passwordViolations = FormValidationService.getViolations(this.passwordForm, {
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
  });

  protected readonly passwordMismatch = computed(() => {
    const np = this.passwordForm.get('newPassword')?.value;
    const cp = this.passwordForm.get('confirmPassword')?.value;
    return np && cp && np !== cp;
  });

  protected readonly pinMismatch = computed(() => {
    const p = this.pinForm.get('pin')?.value;
    const cp = this.pinForm.get('confirmPin')?.value;
    return p && cp && p !== cp;
  });

  protected changePassword(): void {
    if (this.passwordForm.invalid || this.savingPassword() || this.passwordMismatch()) return;
    const val = this.passwordForm.getRawValue();
    this.savingPassword.set(true);

    this.accountService.changePassword({
      currentPassword: val.currentPassword,
      newPassword: val.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.snackbar.success(this.translate.instant('account.passwordChanged'));
      },
      error: () => this.savingPassword.set(false),
    });
  }

  protected setPin(): void {
    if (this.pinForm.invalid || this.savingPin() || this.pinMismatch()) return;
    const val = this.pinForm.getRawValue();
    this.savingPin.set(true);

    this.authService.setPin(val.pin).subscribe({
      next: () => {
        this.savingPin.set(false);
        this.pinForm.reset();
        this.snackbar.success(this.translate.instant('account.pinUpdated'));
      },
      error: () => this.savingPin.set(false),
    });
  }
}
