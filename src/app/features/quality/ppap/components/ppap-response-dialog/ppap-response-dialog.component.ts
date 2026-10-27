import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PpapService } from '../../services/ppap.service';
import { PpapCustomerDecision } from '../../models/ppap-response-request.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';

export interface PpapResponseDialogData {
  submissionId: number;
  submissionNumber: string;
}

@Component({
  selector: 'app-ppap-response-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, SelectComponent, TextareaComponent, ValidationButtonComponent],
  templateUrl: './ppap-response-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PpapResponseDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PpapResponseDialogComponent, boolean>);
  private readonly ppapService = inject(PpapService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<PpapResponseDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly decisionOptions: SelectOption[] = (['Approved', 'Interim', 'Rejected'] as PpapCustomerDecision[]).map(d => ({
    value: d, label: this.translate.instant(`ppap.status${d}`),
  }));

  protected readonly form = new FormGroup({
    customerDecision: new FormControl<PpapCustomerDecision | null>(null, [Validators.required]),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerDecision: this.translate.instant('ppap.customerDecision'),
    notes: this.translate.instant('common.notes'),
  });

  protected close(): void { this.dialogRef.close(false); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.ppapService.recordResponse(this.data.submissionId, {
      customerDecision: v.customerDecision!,
      notes: v.notes.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('ppap.responseRecorded'));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'ppap.saveFailed');
      },
    });
  }
}
