import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';
import { MaterialSpec } from '../../models/material-spec.model';
import { MaterialSpecService } from '../../services/material-spec.service';

export interface MaterialSpecRenameDialogData {
  spec: MaterialSpec;
}

@Component({
  selector: 'app-material-spec-rename-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, ValidationButtonComponent],
  templateUrl: './material-spec-rename-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialSpecRenameDialogComponent {
  private readonly materialSpecs = inject(MaterialSpecService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<MaterialSpecRenameDialogComponent, MaterialSpec | null>);
  protected readonly data = inject<MaterialSpecRenameDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    label: new FormControl<string>(this.data.spec.label, {
      nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(200)],
    }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    label: this.translate.instant('materialSpecs.name'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.materialSpecs.update(this.data.spec.id, { label: this.form.getRawValue().label.trim() }).subscribe({
      next: updated => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('parts.materialSpecsPage.renamed', { name: updated.label }));
        this.dialogRef.close(updated);
      },
      error: () => this.saving.set(false),
    });
  }
}
