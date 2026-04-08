import { ChangeDetectionStrategy, Component, inject, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PartsService } from '../../services/parts.service';
import { Operation } from '../../models/operation.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { DraftConfig } from '../../../../shared/models/draft-config.model';

export interface OperationDialogData {
  partId: number;
  operation?: Operation;
  nextStepNumber?: number;
}

@Component({
  selector: 'app-operation-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, TextareaComponent, EntityPickerComponent, ToggleComponent,
    ValidationPopoverDirective,
    TranslatePipe,
  ],
  templateUrl: './operation-dialog.component.html',
  styleUrl: './operation-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationDialogComponent {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly partsService = inject(PartsService);
  private readonly translate = inject(TranslateService);
  protected readonly matDialogRef = inject(MatDialogRef<OperationDialogComponent>);
  protected readonly data = inject<OperationDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);

  protected readonly draftConfig: DraftConfig = {
    entityType: 'operation',
    entityId: this.data.operation?.id?.toString() ?? 'new',
    route: '/parts',
  };

  protected readonly formGroup = new FormGroup({
    stepNumber: new FormControl<number>(this.data.operation?.stepNumber ?? this.data.nextStepNumber ?? 1, [Validators.required, Validators.min(1)]),
    title: new FormControl(this.data.operation?.title ?? '', [Validators.required, Validators.maxLength(200)]),
    instructions: new FormControl(this.data.operation?.instructions ?? ''),
    workCenterId: new FormControl<number | null>(this.data.operation?.workCenterId ?? null),
    estimatedMinutes: new FormControl<number | null>(this.data.operation?.estimatedMinutes ?? null, [Validators.min(1)]),
    isQcCheckpoint: new FormControl(this.data.operation?.isQcCheckpoint ?? false),
    qcCriteria: new FormControl(this.data.operation?.qcCriteria ?? ''),
  });

  protected readonly violations = FormValidationService.getViolations(this.formGroup, {
    stepNumber: this.translate.instant('parts.stepNumber'),
    title: this.translate.instant('common.title'),
    estimatedMinutes: this.translate.instant('parts.estMinutes'),
  });

  protected save(): void {
    if (this.formGroup.invalid) return;
    this.saving.set(true);

    const raw = this.formGroup.getRawValue();

    if (this.data.operation) {
      this.partsService.updateOperation(this.data.partId, this.data.operation.id, {
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
          this.dialogRef.clearDraft();
          this.matDialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.partsService.createOperation(this.data.partId, {
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
          this.dialogRef.clearDraft();
          this.matDialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
