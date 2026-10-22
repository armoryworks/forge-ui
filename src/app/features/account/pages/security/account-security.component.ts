import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { AccountService } from '../../services/account.service';
import { MfaService } from '../../services/mfa.service';
import { PasskeyService } from '../../../../shared/services/passkey.service';
import { MfaSetupDialogComponent } from '../../components/mfa-setup-dialog/mfa-setup-dialog.component';
import { MfaRecoveryCodesDialogComponent, MfaRecoveryCodesDialogData } from '../../components/mfa-recovery-codes-dialog/mfa-recovery-codes-dialog.component';
import { MfaStatus, MfaDeviceSummary } from '../../models/mfa.model';

const PASSWORD_RULES: readonly { pattern: RegExp; key: string }[] = [
  { pattern: /[A-Z]/, key: 'account.passwordNeedsUppercase' },
  { pattern: /[a-z]/, key: 'account.passwordNeedsLowercase' },
  { pattern: /\d/, key: 'account.passwordNeedsDigit' },
];

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, ValidationButtonComponent, DatePipe],
  templateUrl: './account-security.component.html',
  styleUrl: './account-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurityComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly mfaService = inject(MfaService);
  private readonly passkeyService = inject(PasskeyService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  protected readonly user = this.authService.user;
  protected readonly savingPassword = signal(false);
  protected readonly savingPin = signal(false);
  protected readonly mfaStatus = signal<MfaStatus | null>(null);
  protected readonly mfaLoading = signal(true);

  private readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(8), this.passwordPolicyValidator()],
  });

  private readonly pinControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, this.pinFormatValidator()],
  });

  protected readonly passwordForm = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: this.newPasswordControl,
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, this.matchesValidator((): string => this.newPasswordControl.value, 'account.passwordsDoNotMatch')],
    }),
  });

  protected readonly pinForm = new FormGroup({
    pin: this.pinControl,
    confirmPin: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, this.matchesValidator((): string => this.pinControl.value, 'account.pinsDoNotMatch')],
    }),
  });

  protected readonly passwordViolations = FormValidationService.getViolations(this.passwordForm, {
    currentPassword: this.translate.instant('account.currentPassword'),
    newPassword: this.translate.instant('account.newPassword'),
    confirmPassword: this.translate.instant('account.confirmNewPassword'),
  });

  protected readonly pinViolations = FormValidationService.getViolations(this.pinForm, {
    pin: this.translate.instant('account.pin'),
    confirmPin: this.translate.instant('account.confirmPin'),
  });

  constructor() {
    this.passwordForm.controls.newPassword.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => this.passwordForm.controls.confirmPassword.updateValueAndValidity());
    this.pinForm.controls.pin.valueChanges.pipe(takeUntilDestroyed())
      .subscribe(() => this.pinForm.controls.confirmPin.updateValueAndValidity());
  }

  private matchesValidator(other: () => string, messageKey: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      const target = other();
      if (!value || !target || value === target) return null;
      return { mismatch: { message: this.translate.instant(messageKey) } };
    };
  }

  private passwordPolicyValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      if (!value) return null;
      const failed = PASSWORD_RULES.find(rule => !rule.pattern.test(value));
      return failed ? { passwordPolicy: { message: this.translate.instant(failed.key) } } : null;
    };
  }

  private pinFormatValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      if (!value || /^\d{4,8}$/.test(value)) return null;
      return { pinFormat: { message: this.translate.instant('account.pinFormatInvalid') } };
    };
  }

  protected changePassword(): void {
    if (this.savingPassword()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const val = this.passwordForm.getRawValue();
    this.savingPassword.set(true);

    this.accountService.changePassword({
      currentPassword: val.currentPassword,
      newPassword: val.newPassword,
    }).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.passwordForm.reset();
        this.authService.clearAuth();
        this.router.navigate(['/login'], { queryParams: { reason: 'password_changed' } });
      },
      error: (err: unknown) => {
        this.savingPassword.set(false);
        FormValidationService.applyServerError(this.passwordForm, err);
      },
    });
  }

  protected setPin(): void {
    if (this.savingPin()) return;
    if (this.pinForm.invalid) {
      this.pinForm.markAllAsTouched();
      return;
    }
    const val = this.pinForm.getRawValue();
    this.savingPin.set(true);

    this.authService.setPin(val.pin).subscribe({
      next: () => {
        this.savingPin.set(false);
        this.pinForm.reset();
        this.snackbar.success(this.translate.instant('account.pinUpdated'));
      },
      error: (err: unknown) => {
        this.savingPin.set(false);
        FormValidationService.applyServerError(this.pinForm, err);
      },
    });
  }

  // ── MFA ──

  ngOnInit(): void {
    this.loadMfaStatus();
  }

  protected async addPasskey(): Promise<void> {
    if (!this.passkeyService.supported()) {
      this.snackbar.error(this.translate.instant('account.mfa.passkeyUnsupported'));
      return;
    }
    try {
      const name = await this.passkeyService.register();
      this.snackbar.success(this.translate.instant('account.mfa.passkeyAdded', { name }));
      this.loadMfaStatus();
    } catch {
      this.snackbar.error(this.translate.instant('account.mfa.passkeyIncomplete'));
    }
  }

  private loadMfaStatus(): void {
    this.mfaLoading.set(true);
    this.mfaService.getStatus().subscribe({
      next: (status) => {
        this.mfaStatus.set(status);
        this.mfaLoading.set(false);
      },
      error: () => this.mfaLoading.set(false),
    });
  }

  protected setupMfa(): void {
    this.dialog.open(MfaSetupDialogComponent, { width: '480px' })
      .afterClosed().subscribe((enabled: boolean) => {
        if (!enabled) return;
        if ((this.mfaStatus()?.recoveryCodesRemaining ?? 0) === 0) {
          this.generateRecoveryCodes();
        } else {
          this.loadMfaStatus();
        }
      });
  }

  protected generateRecoveryCodes(): void {
    this.dialog.open(MfaRecoveryCodesDialogComponent, {
      width: '480px',
      data: { remainingCodes: this.mfaStatus()?.isEnabled ? this.mfaStatus()?.recoveryCodesRemaining ?? 0 : 0 } satisfies MfaRecoveryCodesDialogData,
    }).afterClosed().subscribe(() => this.loadMfaStatus());
  }

  protected removeDevice(device: MfaDeviceSummary): void {
    const name = device.deviceName ?? device.deviceType;
    const isLastDevice = (this.mfaStatus()?.devices.length ?? 0) <= 1;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('account.mfaRemoveDeviceTitle'),
        message: this.translate.instant(isLastDevice ? 'account.mfaRemoveLastDevice' : 'account.mfaRemoveDevice', { name }),
        confirmLabel: this.translate.instant('common.remove'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.mfaService.removeDevice(device.id).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('account.mfa.deviceRemoved'));
            this.loadMfaStatus();
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.removeDeviceFailed'),
        });
      }
    });
  }

  protected disableMfa(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('account.mfa.disableTitle'),
        message: this.translate.instant('account.mfa.disableMessage'),
        confirmLabel: this.translate.instant('account.mfa.disable'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.mfaService.disable().subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('account.mfa.disabled'));
            this.loadMfaStatus();
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'errorFallbacksA.disableMfaFailed'),
        });
      }
    });
  }
}
