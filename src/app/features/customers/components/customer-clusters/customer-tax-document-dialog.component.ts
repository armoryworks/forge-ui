import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

import { CustomerTaxDocumentService } from '../../services/customer-tax-document.service';

/**
 * S1 — certificate-metadata dialog shown right after a tax-certificate file
 * is uploaded via the tax-documents cluster's upload zone. Links the freshly
 * created FileAttachment as a CustomerTaxDocument (status Pending).
 */
@Component({
  selector: 'app-customer-tax-document-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './customer-tax-document-dialog.component.html',
  styleUrl: './customer-tax-document-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerTaxDocumentDialogComponent {
  private readonly taxDocumentService = inject(CustomerTaxDocumentService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly customerId = input.required<number>();
  /** The already-uploaded customer FileAttachment being linked as a certificate. */
  readonly fileAttachmentId = input.required<number>();
  readonly fileName = input<string>('');

  /** Emitted after a successful create — parent refreshes + closes. */
  readonly saved = output<void>();
  /** Emitted when the user dismisses without saving. */
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  // CertificateType is a fixed server enum (Resale/Exemption/DirectPay/Other),
  // not DB-driven reference data — a static option list is the sanctioned
  // exception (same shape as the address-type options).
  protected readonly typeOptions: SelectOption[] = [
    { value: 'Resale', label: this.translate.instant('customers.taxDocuments.typeResale') },
    { value: 'Exemption', label: this.translate.instant('customers.taxDocuments.typeExemption') },
    { value: 'DirectPay', label: this.translate.instant('customers.taxDocuments.typeDirectPay') },
    { value: 'Other', label: this.translate.instant('customers.taxDocuments.typeOther') },
  ];

  protected readonly form = new FormGroup({
    stateCode: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)],
    }),
    certificateType: new FormControl<string>('Exemption', { nonNullable: true, validators: [Validators.required] }),
    certificateNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    expirationDate: new FormControl<Date | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    stateCode: this.translate.instant('customers.taxDocuments.stateField'),
    certificateType: this.translate.instant('customers.taxDocuments.typeField'),
    certificateNumber: this.translate.instant('customers.taxDocuments.certificateNumberField'),
    expirationDate: this.translate.instant('customers.taxDocuments.expirationField'),
  });

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();

    this.saving.set(true);
    this.taxDocumentService.createTaxDocument(this.customerId(), {
      fileAttachmentId: this.fileAttachmentId(),
      stateCode: v.stateCode.toUpperCase(),
      certificateType: v.certificateType,
      certificateNumber: v.certificateNumber || undefined,
      expirationDate: v.expirationDate ? toIsoDate(v.expirationDate)! : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('customers.taxDocuments.documentAdded'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
