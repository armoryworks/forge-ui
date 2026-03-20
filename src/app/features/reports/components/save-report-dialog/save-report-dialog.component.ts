import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { TranslatePipe } from '@ngx-translate/core';

export interface SaveReportDialogData {
  name: string;
  description: string;
  isShared: boolean;
}

export interface SaveReportDialogResult {
  name: string;
  description: string;
  isShared: boolean;
}

@Component({
  selector: 'app-save-report-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent,
    InputComponent,
    TextareaComponent,
    ToggleComponent,
    ValidationPopoverDirective,
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
    name: new FormControl(this.data.name, [Validators.required, Validators.maxLength(100)]),
    description: new FormControl(this.data.description),
    isShared: new FormControl(this.data.isShared),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Report Name',
    description: 'Description',
    isShared: 'Shared',
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    this.dialogRef.close({
      name: f.name!,
      description: f.description ?? '',
      isShared: f.isShared ?? false,
    } satisfies SaveReportDialogResult);
  }
}
