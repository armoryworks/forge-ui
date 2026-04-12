import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { AccountService } from '../../services/account.service';
import { MfaService } from '../../services/mfa.service';
import { MfaSetupDialogComponent } from '../../components/mfa-setup-dialog/mfa-setup-dialog.component';
import { MfaRecoveryCodesDialogComponent } from '../../components/mfa-recovery-codes-dialog/mfa-recovery-codes-dialog.component';
import { MfaStatus, MfaDeviceSummary } from '../../models/mfa.model';

@Component({
  selector: 'app-account-security',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, ValidationPopoverDirective, DatePipe],
  templateUrl: './account-security.component.html',
  styleUrl: './account-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurityComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly mfaService = inject(MfaService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly user = this.authService.user;
  protected readonly savingPassword = signal(false);
  protected readonly savingPin = signal(false);
  protected readonly mfaStatus = signal<MfaStatus | null>(null);
  protected readonly mfaLoading = signal(true);

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

  // ── MFA ──

  ngOnInit(): void {
    this.loadMfaStatus();
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
        if (enabled) this.loadMfaStatus();
      });
  }

  protected generateRecoveryCodes(): void {
    this.dialog.open(MfaRecoveryCodesDialogComponent, { width: '480px' })
      .afterClosed().subscribe(() => this.loadMfaStatus());
  }

  protected removeDevice(device: MfaDeviceSummary): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Remove Device?',
        message: `Remove "${device.deviceName ?? device.deviceType}" from your MFA devices? You may lose access if this is your only device.`,
        confirmLabel: 'Remove',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.mfaService.removeDevice(device.id).subscribe({
          next: () => {
            this.snackbar.success('Device removed');
            this.loadMfaStatus();
          },
          error: () => this.snackbar.error('Failed to remove device'),
        });
      }
    });
  }

  protected disableMfa(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Disable MFA?',
        message: 'This will remove all MFA devices and recovery codes. Your account will be less secure.',
        confirmLabel: 'Disable MFA',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.mfaService.disable().subscribe({
          next: () => {
            this.snackbar.success('Two-factor authentication disabled');
            this.loadMfaStatus();
          },
          error: () => this.snackbar.error('Failed to disable MFA'),
        });
      }
    });
  }
}
