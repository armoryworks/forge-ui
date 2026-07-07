import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CustomerTaxDocument } from '../../models/customer-tax-document.model';

import { CustomerTaxDocumentService } from '../../services/customer-tax-document.service';

/**
 * S1 — reject-with-reason dialog for a customer tax document. A dedicated
 * dialog (not ConfirmDialog) because the server requires a free-text reason
 * and ConfirmDialog takes no input.
 */
@Component({
  selector: 'app-customer-tax-document-reject-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './customer-tax-document-reject-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerTaxDocumentRejectDialogComponent {
  private readonly taxDocumentService = inject(CustomerTaxDocumentService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly document = input.required<CustomerTaxDocument>();

  /** Emitted after a successful reject — parent refreshes + closes. */
  readonly rejected = output<void>();
  /** Emitted when the user dismisses without rejecting. */
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    reason: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    reason: this.translate.instant('customers.taxDocuments.rejectReasonField'),
  });

  protected close(): void {
    this.closed.emit();
  }

  protected reject(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    this.taxDocumentService.rejectTaxDocument(this.document().id, this.form.getRawValue().reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('customers.taxDocuments.documentRejected'));
        this.rejected.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
