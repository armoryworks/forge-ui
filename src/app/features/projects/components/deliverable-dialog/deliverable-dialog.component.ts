import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { DeliverableService } from '../../services/deliverable.service';
import { Deliverable } from '../../models/deliverable.model';
import { DELIVERABLE_TYPE_GROUP } from '../../models/project-roles.model';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';

export interface DeliverableDialogData {
  projectId: number;
  customerId: number | null;
  deliverable: Deliverable | null;
}

@Component({
  selector: 'app-deliverable-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './deliverable-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliverableDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DeliverableDialogComponent, Deliverable | undefined>);
  private readonly deliverableService = inject(DeliverableService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<DeliverableDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  private readonly existing = this.data.deliverable;

  protected readonly typeOptions = toSignal<SelectOption[] | null, null>(
    this.referenceData.getByGroup(DELIVERABLE_TYPE_GROUP).pipe(
      map(items => items.filter(i => i.isActive).map(i => ({ value: i.id, label: i.label }) as SelectOption)),
    ),
    { initialValue: null },
  );

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.existing?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)] }),
    description: new FormControl<string>(this.existing?.description ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    deliverableTypeId: new FormControl<number | null>(this.existing?.deliverableTypeId ?? null, [Validators.required]),
    dueDate: new FormControl<Date | null>(fromIsoDate(this.existing?.dueDate ?? null)),
    jobId: new FormControl<number | null>(this.existing?.jobId ?? null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('common.name'),
    description: this.translate.instant('common.description'),
    deliverableTypeId: this.translate.instant('deliverables.type'),
    dueDate: this.translate.instant('common.dueDate'),
    jobId: this.translate.instant('projects.job'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const request = {
      name: v.name.trim(),
      description: v.description.trim() || null,
      jobId: v.jobId,
      projectId: this.data.projectId,
      customerId: this.existing?.customerId ?? this.data.customerId,
      deliverableTypeId: v.deliverableTypeId!,
      dueDate: toIsoDate(v.dueDate),
      fileAttachmentIds: this.existing?.fileAttachmentIds ?? null,
      cloudLinkExternalId: this.existing?.cloudLinkExternalId ?? null,
    };
    const call = this.existing
      ? this.deliverableService.update(this.existing.id, { ...request, status: this.existing.status })
      : this.deliverableService.create(request);
    call.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(this.existing ? 'deliverables.updated' : 'deliverables.created'));
        this.dialogRef.close(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'deliverables.saveFailed');
      },
    });
  }
}
