import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { SendPoEmailDialogData } from '../../models/send-po-email-dialog-data.model';

function splitAddresses(value: string): string[] {
  return value.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0);
}

function isEmail(address: string): boolean {
  return Validators.email(new FormControl(address)) === null;
}

function emailAddressValidator(control: AbstractControl<string>): ValidationErrors | null {
  const address = (control.value ?? '').trim();
  return address && !isEmail(address) ? { email: true } : null;
}

function emailListValidator(control: AbstractControl<string>): ValidationErrors | null {
  return splitAddresses(control.value ?? '').every(isEmail) ? null : { email: true };
}

@Component({
  selector: 'app-send-po-email-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './send-po-email-dialog.component.html',
  styleUrl: './send-po-email-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendPoEmailDialogComponent {
  private readonly poService = inject(PurchaseOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<SendPoEmailDialogComponent, boolean | undefined>);
  protected readonly data = inject<SendPoEmailDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    to: new FormControl<string>(this.data.recipientEmail, {
      nonNullable: true, validators: [Validators.required, emailAddressValidator, Validators.maxLength(320)],
    }),
    cc: new FormControl<string>('', {
      nonNullable: true, validators: [emailListValidator, Validators.maxLength(1000)],
    }),
    message: new FormControl<string>('', {
      nonNullable: true, validators: [Validators.maxLength(2000)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    to: this.translate.instant('poManage.emailTo'),
    cc: this.translate.instant('poManage.emailCc'),
    message: this.translate.instant('poManage.emailMessage'),
  });

  protected send(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    const to = v.to.trim();
    const cc = splitAddresses(v.cc).join(', ');
    this.poService.sendPurchaseOrderEmail(this.data.purchaseOrderId, {
      to,
      cc: cc || undefined,
      message: v.message.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('poManage.emailSent', { to }));
        this.dialogRef.close(true);
      },
      error: () => this.saving.set(false),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
