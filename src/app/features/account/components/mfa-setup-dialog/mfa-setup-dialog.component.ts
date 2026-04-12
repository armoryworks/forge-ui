import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { QrCodeComponent } from '../../../../shared/components/qr-code/qr-code.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { MfaService } from '../../services/mfa.service';
import { MfaSetupResponse } from '../../models/mfa.model';

@Component({
  selector: 'app-mfa-setup-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogComponent, InputComponent, QrCodeComponent],
  templateUrl: './mfa-setup-dialog.component.html',
  styleUrl: './mfa-setup-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaSetupDialogComponent {
  private readonly mfaService = inject(MfaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialogRef = inject(MatDialogRef<MfaSetupDialogComponent>);

  protected readonly step = signal<'loading' | 'scan' | 'verify' | 'complete'>('loading');
  protected readonly setupData = signal<MfaSetupResponse | null>(null);
  protected readonly verifying = signal(false);
  protected readonly verifyError = signal<string | null>(null);
  protected readonly showManualKey = signal(false);

  protected readonly codeControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
  });

  constructor() {
    this.beginSetup();
  }

  private beginSetup(): void {
    this.mfaService.beginSetup().subscribe({
      next: (data) => {
        this.setupData.set(data);
        this.step.set('scan');
      },
      error: () => {
        this.snackbar.error('Failed to start MFA setup');
        this.dialogRef.close(false);
      },
    });
  }

  protected verifyCode(): void {
    if (this.codeControl.invalid || this.verifying()) return;
    const data = this.setupData();
    if (!data) return;

    this.verifying.set(true);
    this.verifyError.set(null);

    this.mfaService.verifySetup(data.deviceId, this.codeControl.value).subscribe({
      next: (result) => {
        this.verifying.set(false);
        if (result.verified) {
          this.step.set('complete');
        } else {
          this.verifyError.set('Invalid code. Please try again.');
          this.codeControl.reset();
        }
      },
      error: () => {
        this.verifying.set(false);
        this.verifyError.set('Invalid code. Please try again.');
        this.codeControl.reset();
      },
    });
  }

  protected copyManualKey(): void {
    const key = this.setupData()?.manualEntryKey;
    if (key) {
      navigator.clipboard.writeText(key);
      this.snackbar.success('Key copied to clipboard');
    }
  }

  protected close(): void {
    this.dialogRef.close(this.step() === 'complete');
  }
}
