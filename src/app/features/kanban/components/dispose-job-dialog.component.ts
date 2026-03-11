import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { KanbanService } from '../services/kanban.service';
import { JobDetail } from '../models/job-detail.model';
import { JobDisposition } from '../models/job-disposition.type';

export interface DisposeJobDialogData {
  jobId: number;
  jobNumber: string;
}

@Component({
  selector: 'app-dispose-job-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogComponent, SelectComponent, TextareaComponent, ValidationPopoverDirective],
  templateUrl: './dispose-job-dialog.component.html',
  styleUrl: './dispose-job-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisposeJobDialogComponent {
  readonly dialogRef = inject(MatDialogRef<DisposeJobDialogComponent>);
  readonly data = inject<DisposeJobDialogData>(MAT_DIALOG_DATA);
  private readonly kanbanService = inject(KanbanService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly saving = signal(false);

  readonly form = new FormGroup({
    disposition: new FormControl<JobDisposition | null>(null, [Validators.required]),
    notes: new FormControl('', [Validators.maxLength(2000)]),
  });

  readonly violations = FormValidationService.getViolations(this.form, {
    disposition: 'Disposition',
    notes: 'Notes',
  });

  readonly dispositionOptions: SelectOption[] = [
    { value: 'ShipToCustomer', label: 'Ship to Customer' },
    { value: 'AddToInventory', label: 'Add to Inventory' },
    { value: 'CapitalizeAsAsset', label: 'Capitalize as Asset' },
    { value: 'Scrap', label: 'Scrap' },
    { value: 'HoldForReview', label: 'Hold for Review' },
  ];

  save(): void {
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.kanbanService.disposeJob(this.data.jobId, {
      disposition: raw.disposition!,
      notes: raw.notes || undefined,
    }).subscribe({
      next: (result: JobDetail) => {
        this.saving.set(false);
        this.snackbar.success('Job disposed.');
        this.dialogRef.close(result);
      },
      error: () => this.saving.set(false),
    });
  }
}
