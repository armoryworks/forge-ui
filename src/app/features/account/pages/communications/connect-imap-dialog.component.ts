import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { IMAP_PRESETS, ImapPreset } from '../../models/imap-connect-request.model';
import { CommunicationsService } from '../../services/communications.service';

/**
 * Wave 8 phase 1h — IMAP connect dialog. 2-step UX:
 *   Step 0: pick a preset (Gmail / Outlook / Yahoo / Fastmail / iCloud /
 *           Custom). Each preset pre-fills host/port/SSL — most users
 *           never need to touch those fields.
 *   Step 1: enter username + password. Optional: display label, custom
 *           mailbox folder. The "Connect" button posts to the dedicated
 *           server endpoint that test-authenticates before persisting,
 *           so wrong creds surface immediately as a toast rather than
 *           a silent broken connection.
 */
@Component({
  selector: 'app-connect-imap-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent,
    InputComponent, ToggleComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './connect-imap-dialog.component.html',
  styleUrl: './connect-imap-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectImapDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConnectImapDialogComponent, boolean>);
  private readonly service = inject(CommunicationsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  protected readonly translate = inject(TranslateService);

  protected readonly presets = IMAP_PRESETS;
  protected readonly currentStep = signal(0);
  protected readonly preset = signal<ImapPreset | null>(null);
  protected readonly saving = signal(false);

  protected readonly isCustom = computed(() => this.preset()?.id === 'custom');

  protected readonly form = new FormGroup({
    host: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    port: new FormControl(993, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(65535)] }),
    useSsl: new FormControl(true, { nonNullable: true }),
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    mailbox: new FormControl('INBOX', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    displayLabel: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    host: this.translate.instant('account.communications.imap.host'),
    port: this.translate.instant('account.communications.imap.port'),
    username: this.translate.instant('account.communications.imap.username'),
    password: this.translate.instant('account.communications.imap.password'),
    mailbox: this.translate.instant('account.communications.imap.mailbox'),
    displayLabel: this.translate.instant('account.communications.displayLabel'),
  });

  protected pickPreset(preset: ImapPreset): void {
    this.preset.set(preset);
    this.form.patchValue({
      host: preset.host,
      port: preset.port,
      useSsl: preset.useSsl,
    });
    this.currentStep.set(1);
  }

  protected back(): void {
    this.currentStep.set(0);
  }

  protected connect(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);

    this.service.connectImap({
      host: v.host.trim(),
      port: v.port,
      useSsl: v.useSsl,
      username: v.username.trim(),
      password: v.password,
      mailbox: v.mailbox.trim() || null,
      displayLabel: v.displayLabel.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('account.communications.imap.connectSuccess'));
        this.dialogRef.close(true);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        // Server returns 409 with a friendly message — surface it as a
        // toast so the user knows whether to fix creds vs host vs both.
        const detail = (err.error?.detail as string | undefined)
          ?? this.translate.instant('account.communications.imap.connectFailed');
        this.toast.show({
          severity: 'error',
          title: this.translate.instant('account.communications.imap.connectFailedTitle'),
          message: detail,
        });
      },
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
