import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { RunSchedulerRequest } from '../../models/scheduling.model';

const DEFAULT_HORIZON_DAYS = 30;

@Component({
  selector: 'app-run-schedule-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, DatepickerComponent, SelectComponent, ValidationButtonComponent],
  templateUrl: './run-schedule-dialog.component.html',
  styleUrl: './run-schedule-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RunScheduleDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RunScheduleDialogComponent, RunSchedulerRequest | undefined>);
  private readonly translate = inject(TranslateService);

  protected readonly directionOptions: SelectOption[] = [
    { value: 'Forward', label: this.translate.instant('scheduling.runDialog.forward') },
    { value: 'Backward', label: this.translate.instant('scheduling.runDialog.backward') },
  ];

  protected readonly priorityRuleOptions: SelectOption[] = [
    { value: 'DueDate', label: this.translate.instant('scheduling.rules.dueDate') },
    { value: 'Priority', label: this.translate.instant('scheduling.rules.priority') },
    { value: 'FIFO', label: this.translate.instant('scheduling.rules.fifo') },
  ];

  protected readonly form = new FormGroup({
    direction: new FormControl<'Forward' | 'Backward'>('Forward', { nonNullable: true, validators: [Validators.required] }),
    scheduleFrom: new FormControl<Date | null>(startOfToday(), { validators: [Validators.required] }),
    scheduleTo: new FormControl<Date | null>(addDays(startOfToday(), DEFAULT_HORIZON_DAYS), { validators: [Validators.required] }),
    priorityRule: new FormControl<string>('DueDate', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: [this.rangeValidator()] });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    direction: this.translate.instant('scheduling.runDialog.direction'),
    scheduleFrom: this.translate.instant('scheduling.runDialog.from'),
    scheduleTo: this.translate.instant('scheduling.runDialog.to'),
    priorityRule: this.translate.instant('scheduling.runDialog.priorityRule'),
  });

  protected confirm(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.dialogRef.close({
      direction: v.direction,
      scheduleFrom: toDateOnly(v.scheduleFrom)!,
      scheduleTo: toDateOnly(v.scheduleTo)!,
      priorityRule: v.priorityRule,
    });
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  private rangeValidator(): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const from = group.get('scheduleFrom')?.value as Date | null;
      const to = group.get('scheduleTo')?.value as Date | null;
      if (!from || !to || to >= from) return null;
      return { dateRange: { message: this.translate.instant('scheduling.runDialog.toBeforeFrom'), field: 'scheduleTo' } };
    };
  }
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
