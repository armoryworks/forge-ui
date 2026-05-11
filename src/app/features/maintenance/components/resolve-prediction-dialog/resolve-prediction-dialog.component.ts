import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ResolvePredictionRequest } from '../../models/prediction.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

export interface ResolvePredictionDialogData {
  mode: 'resolve' | 'false-positive';
}

@Component({
  selector: 'app-resolve-prediction-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './resolve-prediction-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResolvePredictionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ResolvePredictionDialogComponent, ResolvePredictionRequest | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ResolvePredictionDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    notes: this.translate.instant('maintenance.resolveDialog.fieldNotes'),
  });

  protected get isResolve(): boolean { return this.data.mode === 'resolve'; }

  protected close(): void { this.dialogRef.close(); }

  protected confirm(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({ notes: this.form.controls.notes.value.trim() });
  }
}
