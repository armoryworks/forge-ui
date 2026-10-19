import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { TranslatePipe } from '@ngx-translate/core';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';

export interface SaveReportDialogData {
  name: string;
  description: string;
  isShared: boolean;
  submit: (result: SaveReportDialogResult) => Observable<unknown>;
}

export interface SaveReportDialogResult {
  name: string;
  description: string;
  isShared: boolean;
}

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

@Component({
  selector: 'app-save-report-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './save-report-dialog.component.html',
  styleUrl: './save-report-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveReportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SaveReportDialogComponent>);
  private readonly data = inject<SaveReportDialogData>(MAT_DIALOG_DATA);

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.name, [requiredTrimmed, Validators.maxLength(NAME_MAX_LENGTH)]),
    description: new FormControl(this.data.description, [Validators.maxLength(DESCRIPTION_MAX_LENGTH)]),
    isShared: new FormControl(this.data.isShared),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Report Name',
    description: 'Description',
    isShared: 'Shared',
  });

  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;
  protected readonly saving = signal(false);

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    const result: SaveReportDialogResult = {
      name: f.name!.trim(),
      description: f.description ?? '',
      isShared: f.isShared ?? false,
    };
    this.saving.set(true);
    this.data.submit(result).subscribe({
      next: () => this.dialogRef.close(result),
      error: () => this.saving.set(false),
    });
  }
}
