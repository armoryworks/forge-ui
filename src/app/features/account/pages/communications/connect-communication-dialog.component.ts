import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CommunicationProviderInfo } from '../../models/communication-sync.model';
import { CommunicationsService } from '../../services/communications.service';

export interface ConnectCommunicationDialogData {
  provider: CommunicationProviderInfo;
}

/**
 * Wave 8 — connect-mailbox dialog. Today the connection just stores label
 * + external account id; the matcher uses these for display + the future
 * adapter handshake. OAuth/IMAP credential fields land per-adapter as
 * each ICommunicationSyncProvider implementation is wired (planned).
 */
@Component({
  selector: 'app-connect-communication-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent,
    InputComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './connect-communication-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectCommunicationDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ConnectCommunicationDialogComponent, boolean>);
  private readonly service = inject(CommunicationsService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly translate = inject(TranslateService);

  protected readonly data = inject<ConnectCommunicationDialogData>(MAT_DIALOG_DATA);
  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    displayLabel: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    externalAccountId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    externalAccountId: this.translate.instant('account.communications.externalAccountId'),
    displayLabel: this.translate.instant('account.communications.displayLabel'),
  });

  protected get externalAccountPlaceholder(): string {
    return this.data.provider.kind === 'Email'
      ? this.translate.instant('account.communications.externalAccountIdEmailPlaceholder')
      : this.translate.instant('account.communications.externalAccountIdVoicePlaceholder');
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    const val = this.form.getRawValue();
    this.saving.set(true);

    this.service.create({
      kind: this.data.provider.kind,
      providerId: this.data.provider.providerId,
      displayLabel: val.displayLabel.trim() || null,
      externalAccountId: val.externalAccountId.trim() || null,
      configJson: null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('account.communications.connected', {
          provider: this.data.provider.displayName,
        }));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}
