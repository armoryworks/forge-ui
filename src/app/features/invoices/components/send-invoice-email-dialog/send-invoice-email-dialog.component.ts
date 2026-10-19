import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { InvoiceService } from '../../services/invoice.service';
import { InvoiceEmailRecipient } from '../../models/invoice-email-recipient.model';
import { SendInvoiceEmailDialogData } from '../../models/send-invoice-email-dialog-data.model';

/**
 * Emails a finalized invoice's PDF to the customer. The recipient is pre-filled from the
 * customer's Billing contact (then the customer email, then the primary contact) and can be
 * changed before sending. Closes with `true` once the email is queued.
 */
@Component({
  selector: 'app-send-invoice-email-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent, LoadingBlockDirective],
  templateUrl: './send-invoice-email-dialog.component.html',
  styleUrl: './send-invoice-email-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendInvoiceEmailDialogComponent {
  private readonly invoiceService = inject(InvoiceService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<SendInvoiceEmailDialogComponent, boolean | undefined>);
  protected readonly data = inject<SendInvoiceEmailDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly resolving = signal(true);
  protected readonly recipient = signal<InvoiceEmailRecipient | null>(null);

  protected readonly form = new FormGroup({
    recipientEmail: new FormControl<string>('', {
      nonNullable: true, validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    recipientEmail: this.translate.instant('invoices.sendEmail.recipient'),
  });

  constructor() {
    this.invoiceService.getEmailRecipient(this.data.invoiceId).subscribe({
      next: (recipient) => {
        this.recipient.set(recipient);
        if (recipient.email && !this.form.controls.recipientEmail.dirty) {
          this.form.controls.recipientEmail.setValue(recipient.email);
        }
        this.resolving.set(false);
      },
      error: () => this.resolving.set(false),
    });
  }

  protected send(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const recipientEmail = this.form.getRawValue().recipientEmail.trim();
    this.invoiceService.emailInvoice(this.data.invoiceId, { recipientEmail }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('invoices.sendEmail.sent', { email: recipientEmail }));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
