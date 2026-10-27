import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';
import { Shift, UpdateShiftRequest, WorkCenter } from '../../models/scheduling.model';
import { SHIFT_DAYS, WEEKDAY_FLAGS, daysToFlags, flagsToDays } from './shift-days.const';

export interface ShiftDialogData {
  shift?: Shift;
  workCenters: WorkCenter[];
}

type WorkCenterRow = FormGroup<{ workCenterId: FormControl<number | null>; days: FormControl<number[]> }>;

@Component({
  selector: 'app-shift-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './shift-dialog.component.html',
  styleUrl: './shift-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ShiftDialogComponent, UpdateShiftRequest | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ShiftDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.shift;

  protected readonly workCenterOptions: SelectOption[] = this.data.workCenters
    .filter(wc => wc.isActive || this.data.shift?.workCenters?.some(s => s.workCenterId === wc.id))
    .map(wc => ({ value: wc.id, label: `${wc.code} - ${wc.name}` }));

  protected readonly dayOptions: SelectOption[] = SHIFT_DAYS.map(d => ({ value: d.flag, label: this.translate.instant(d.labelKey) }));

  protected readonly workCenters = new FormArray<WorkCenterRow>(
    (this.data.shift?.workCenters ?? []).map(wc => this.row(wc.workCenterId, flagsToDays(wc.daysOfWeek))),
    { validators: control => this.duplicateWorkCenters(control) });

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.data.shift?.name ?? '', { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(100)] }),
    startTime: new FormControl<string>(this.hhmm(this.data.shift?.startTime) ?? '07:00', { nonNullable: true, validators: [Validators.required] }),
    endTime: new FormControl<string>(this.hhmm(this.data.shift?.endTime) ?? '15:30', { nonNullable: true, validators: [Validators.required] }),
    breakMinutes: new FormControl<number>(this.data.shift?.breakMinutes ?? 30, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    isActive: new FormControl<boolean>(this.data.shift?.isActive ?? true, { nonNullable: true }),
    workCenters: this.workCenters,
  }, { validators: control => this.breakError(control) });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('scheduling.shiftDialog.name'),
    startTime: this.translate.instant('scheduling.shiftDialog.startTime'),
    endTime: this.translate.instant('scheduling.shiftDialog.endTime'),
    breakMinutes: this.translate.instant('scheduling.shiftDialog.breakMinutes'),
    workCenters: this.translate.instant('scheduling.shiftDialog.workCenters'),
  });

  protected addWorkCenter(): void {
    this.workCenters.push(this.row(null, flagsToDays(WEEKDAY_FLAGS)));
  }

  protected removeWorkCenter(index: number): void {
    this.workCenters.removeAt(index);
  }

  private row(workCenterId: number | null, days: number[]): WorkCenterRow {
    return new FormGroup({
      workCenterId: new FormControl<number | null>(workCenterId, [Validators.required]),
      days: new FormControl<number[]>(days, { nonNullable: true, validators: [Validators.required] }),
    });
  }

  private hhmm(time: string | undefined): string | null {
    return time ? time.slice(0, 5) : null;
  }

  private minutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private breakError(control: AbstractControl): ValidationErrors | null {
    const { startTime, endTime, breakMinutes } = (control as FormGroup).getRawValue() as { startTime: string; endTime: string; breakMinutes: number };
    if (!startTime || !endTime) return null;
    let span = this.minutes(endTime) - this.minutes(startTime);
    if (span <= 0) span += 24 * 60;
    return Number(breakMinutes) < span
      ? null
      : { breakMinutes: { message: this.translate.instant('scheduling.shiftDialog.breakTooLong') } };
  }

  private duplicateWorkCenters(control: AbstractControl): ValidationErrors | null {
    const ids = (control as FormArray<WorkCenterRow>).getRawValue().map(r => r.workCenterId).filter(id => id !== null);
    return new Set(ids).size === ids.length
      ? null
      : { workCenters: { message: this.translate.instant('scheduling.shiftDialog.duplicateWorkCenter') } };
  }

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    this.dialogRef.close({
      name: f.name.trim(),
      startTime: `${f.startTime}:00`,
      endTime: `${f.endTime}:00`,
      breakMinutes: Number(f.breakMinutes),
      isActive: f.isActive,
      workCenters: f.workCenters.map(r => ({ workCenterId: r.workCenterId!, daysOfWeek: daysToFlags(r.days) })),
    });
  }
}
