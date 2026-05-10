import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../shared/utils/date.utils';
import {
  CreateMasterScheduleRequest,
  MasterScheduleDetail,
  UpdateMasterScheduleRequest,
} from '../models/mrp.model';

export interface MasterScheduleDialogData {
  /** When provided, the dialog opens in edit mode and prefills lines. */
  schedule?: MasterScheduleDetail;
}

export type MasterScheduleDialogResult =
  | { mode: 'create'; request: CreateMasterScheduleRequest }
  | { mode: 'update'; id: number; request: UpdateMasterScheduleRequest };

interface LineFormGroup {
  id: FormControl<number | null>;
  partId: FormControl<number | null>;
  quantity: FormControl<number | null>;
  dueDate: FormControl<Date | null>;
  notes: FormControl<string>;
}

/**
 * Master Production Schedule editor. Header captures name + description +
 * date range; the lines array is the per-part build commitment that
 * downstream MRP consumes as `MasterSchedule` demand. Lines must have a
 * part + qty + due date; due dates must fall within the header range.
 */
@Component({
  selector: 'app-master-schedule-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, DatepickerComponent, TextareaComponent,
    EntityPickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './master-schedule-dialog.component.html',
  styleUrl: './master-schedule-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MasterScheduleDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<MasterScheduleDialogComponent, MasterScheduleDialogResult | undefined>);
  private readonly data = inject<MasterScheduleDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  protected readonly translate = inject(TranslateService);

  protected readonly editing = !!this.data.schedule;
  protected readonly editingId = this.data.schedule?.id ?? null;

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.data.schedule?.name ?? '', {
      nonNullable: true, validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl<string>(this.data.schedule?.description ?? '', { nonNullable: true }),
    periodStart: new FormControl<Date | null>(
      this.data.schedule?.periodStart ? new Date(this.data.schedule.periodStart) : null,
      [Validators.required],
    ),
    periodEnd: new FormControl<Date | null>(
      this.data.schedule?.periodEnd ? new Date(this.data.schedule.periodEnd) : null,
      [Validators.required],
    ),
    lines: new FormArray<FormGroup<LineFormGroup>>(
      (this.data.schedule?.lines ?? []).map(l => this.buildLine({
        id: l.id, partId: l.partId, quantity: l.quantity,
        dueDate: new Date(l.dueDate), notes: l.notes ?? '',
      })),
      [Validators.minLength(1)],
    ),
  });

  protected readonly lines = this.form.controls.lines;

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('mrp.scheduleDialog.fieldName'),
    periodStart: this.translate.instant('mrp.scheduleDialog.fieldStart'),
    periodEnd: this.translate.instant('mrp.scheduleDialog.fieldEnd'),
    lines: this.translate.instant('mrp.scheduleDialog.fieldLines'),
  });

  protected readonly title = computed(() => this.translate.instant(
    this.editing ? 'mrp.scheduleDialog.titleEdit' : 'mrp.scheduleDialog.titleCreate',
  ));

  protected readonly saving = signal(false);

  protected addLine(): void {
    this.lines.push(this.buildLine());
    this.lines.markAsDirty();
  }

  protected removeLine(index: number): void {
    this.lines.removeAt(index);
    this.lines.markAsDirty();
  }

  private buildLine(values?: { id?: number; partId?: number; quantity?: number; dueDate?: Date; notes?: string }): FormGroup<LineFormGroup> {
    return new FormGroup<LineFormGroup>({
      id: new FormControl<number | null>(values?.id ?? null),
      partId: new FormControl<number | null>(values?.partId ?? null, [Validators.required]),
      quantity: new FormControl<number | null>(values?.quantity ?? null, [Validators.required, Validators.min(0.0001)]),
      dueDate: new FormControl<Date | null>(values?.dueDate ?? null, [Validators.required]),
      notes: new FormControl<string>(values?.notes ?? '', { nonNullable: true }),
    });
  }

  protected confirm(): void {
    if (this.form.invalid || this.lines.length === 0) return;
    const v = this.form.getRawValue();

    const lines = v.lines.map(l => ({
      partId: l.partId!,
      quantity: l.quantity!,
      dueDate: toIsoDate(l.dueDate)!,
      notes: l.notes?.trim() || undefined,
    }));

    if (this.editing && this.editingId !== null) {
      const linesWithIds = v.lines.map((l, i) => ({
        ...lines[i],
        id: l.id ?? undefined,
      }));
      this.dialogRef.close({
        mode: 'update',
        id: this.editingId,
        request: {
          name: v.name.trim(),
          description: v.description?.trim() || undefined,
          periodStart: toIsoDate(v.periodStart)!,
          periodEnd: toIsoDate(v.periodEnd)!,
          lines: linesWithIds,
        },
      });
    } else {
      this.dialogRef.close({
        mode: 'create',
        request: {
          name: v.name.trim(),
          description: v.description?.trim() || undefined,
          periodStart: toIsoDate(v.periodStart)!,
          periodEnd: toIsoDate(v.periodEnd)!,
          lines,
        },
      });
    }
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
