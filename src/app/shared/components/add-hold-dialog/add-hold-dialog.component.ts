import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../dialog/dialog.component';
import { SelectComponent, SelectOption } from '../select/select.component';
import { TextareaComponent } from '../textarea/textarea.component';
import { ValidationPopoverDirective } from '../../directives/validation-popover.directive';
import { FormValidationService } from '../../services/form-validation.service';
import { SnackbarService } from '../../services/snackbar.service';
import { StatusTrackingService } from '../../services/status-tracking.service';

export interface AddHoldDialogData {
  entityType: string;
  entityId: number;
  holdOptions: SelectOption[];
}

@Component({
  selector: 'app-add-hold-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogComponent, SelectComponent, TextareaComponent, ValidationPopoverDirective],
  templateUrl: './add-hold-dialog.component.html',
  styleUrl: './add-hold-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddHoldDialogComponent {
  readonly dialogRef = inject(MatDialogRef<AddHoldDialogComponent>);
  readonly data: AddHoldDialogData = inject(MAT_DIALOG_DATA);
  private readonly statusTrackingService = inject(StatusTrackingService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    statusCode: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    statusCode: 'Hold Type',
    notes: 'Reason',
  });

  protected save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const { statusCode, notes } = this.form.getRawValue();

    this.statusTrackingService.addHold(
      this.data.entityType,
      this.data.entityId,
      { statusCode, notes: notes || undefined },
    ).subscribe({
      next: (entry) => {
        this.saving.set(false);
        this.dialogRef.close(entry);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}
