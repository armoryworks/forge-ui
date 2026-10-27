import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CoaService } from '../../services/coa.service';
import { CertificateOfAnalysis } from '../../models/certificate-of-analysis.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

export interface GenerateCoaDialogData {
  lotId: number;
  lotNumber: string;
}

@Component({
  selector: 'app-generate-coa-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, EntityPickerComponent, SelectComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './generate-coa-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateCoaDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<GenerateCoaDialogComponent, CertificateOfAnalysis | undefined>);
  private readonly coaService = inject(CoaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<GenerateCoaDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly languageOptions: SelectOption[] = [
    { value: 'en', label: this.translate.instant('coa.languageEnglish') },
    { value: 'es', label: this.translate.instant('coa.languageSpanish') },
  ];

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null),
    language: new FormControl<string>('en', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: this.translate.instant('common.customer'),
    language: this.translate.instant('coa.language'),
    notes: this.translate.instant('common.notes'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected generate(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.coaService.generate({
      lotId: this.data.lotId,
      customerId: value.customerId,
      language: value.language,
      notes: value.notes.trim() || null,
    }).subscribe({
      next: certificate => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(certificate.conforms ? 'coa.generated' : 'coa.generatedNonConforming'));
        this.dialogRef.close(certificate);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'coa.generateFailed');
      },
    });
  }
}
