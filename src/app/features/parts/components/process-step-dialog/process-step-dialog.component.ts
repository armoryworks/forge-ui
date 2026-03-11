import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { PartsService } from '../../services/parts.service';
import { ProcessStep } from '../../models/process-step.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

export interface ProcessStepDialogData {
  partId: number;
  step?: ProcessStep;
  nextStepNumber?: number;
}

@Component({
  selector: 'app-process-step-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, EntityPickerComponent, ToggleComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './process-step-dialog.component.html',
  styleUrl: './process-step-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessStepDialogComponent {
  private readonly partsService = inject(PartsService);
  protected readonly dialogRef = inject(MatDialogRef<ProcessStepDialogComponent>);
  protected readonly data = inject<ProcessStepDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    stepNumber: new FormControl<number>(this.data.step?.stepNumber ?? this.data.nextStepNumber ?? 1, [Validators.required, Validators.min(1)]),
    title: new FormControl(this.data.step?.title ?? '', [Validators.required, Validators.maxLength(200)]),
    instructions: new FormControl(this.data.step?.instructions ?? ''),
    workCenterId: new FormControl<number | null>(this.data.step?.workCenterId ?? null),
    estimatedMinutes: new FormControl<number | null>(this.data.step?.estimatedMinutes ?? null, [Validators.min(1)]),
    isQcCheckpoint: new FormControl(this.data.step?.isQcCheckpoint ?? false),
    qcCriteria: new FormControl(this.data.step?.qcCriteria ?? ''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    stepNumber: 'Step #',
    title: 'Title',
    estimatedMinutes: 'Est. Minutes',
  });

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();

    if (this.data.step) {
      this.partsService.updateProcessStep(this.data.partId, this.data.step.id, {
        stepNumber: raw.stepNumber ?? undefined,
        title: raw.title ?? undefined,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMinutes: raw.estimatedMinutes ?? undefined,
        isQcCheckpoint: raw.isQcCheckpoint ?? undefined,
        qcCriteria: raw.qcCriteria || undefined,
      }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.partsService.createProcessStep(this.data.partId, {
        stepNumber: raw.stepNumber!,
        title: raw.title!,
        instructions: raw.instructions || undefined,
        workCenterId: raw.workCenterId ?? undefined,
        estimatedMinutes: raw.estimatedMinutes ?? undefined,
        isQcCheckpoint: raw.isQcCheckpoint ?? false,
        qcCriteria: raw.qcCriteria || undefined,
      }).subscribe({
        next: (result) => {
          this.saving.set(false);
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
