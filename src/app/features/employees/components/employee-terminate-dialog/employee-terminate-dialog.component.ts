import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { todayStart, toIsoDate } from '../../../../shared/utils/date.utils';

import { EmployeeService } from '../../services/employee.service';
import { TerminationResult } from '../../models/termination-result.model';
import { EmployeeTerminateDialogData } from './employee-terminate-dialog-data.model';

export const TERMINATION_REASON_GROUP = 'termination_reason';

@Component({
  selector: 'app-employee-terminate-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, SelectComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './employee-terminate-dialog.component.html',
  styleUrl: './employee-terminate-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeTerminateDialogComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<EmployeeTerminateDialogComponent, TerminationResult | null>);
  protected readonly data = inject<EmployeeTerminateDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly reasonOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    terminationDate: new FormControl<Date | null>(todayStart(), { validators: [Validators.required] }),
    reasonCode: new FormControl<string | null>(null, { validators: [Validators.required] }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    rehireEligible: new FormControl<boolean>(true, { nonNullable: true }),
    finalPayRequired: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    terminationDate: this.translate.instant('employees.termination.date'),
    reasonCode: this.translate.instant('employees.termination.reason'),
    notes: this.translate.instant('employees.termination.notes'),
  });

  private readonly dateValue = toSignal(
    this.form.controls.terminationDate.valueChanges.pipe(startWith(this.form.controls.terminationDate.value)),
    { initialValue: this.form.controls.terminationDate.value },
  );

  protected readonly scheduled = computed(() => {
    const date = this.dateValue();
    return !!date && date.getTime() > todayStart().getTime();
  });

  protected readonly hasLogin = this.data.employee.hasLogin !== false;

  protected readonly checklist = computed<string[]>(() => {
    const items = this.hasLogin
      ? [
        'employees.termination.checklist.deactivate',
        'employees.termination.checklist.signOut',
        'employees.termination.checklist.credentials',
        'employees.termination.checklist.timers',
        'employees.termination.checklist.jobs',
        'employees.termination.checklist.leave',
      ]
      : ['employees.termination.checklist.profileOnly'];
    return [...items, 'employees.termination.checklist.audit'];
  });

  protected readonly displayName = `${this.data.employee.lastName}, ${this.data.employee.firstName}`;

  constructor() {
    this.referenceData.getAsOptions(TERMINATION_REASON_GROUP).subscribe({
      next: options => this.reasonOptions.set(options),
      error: () => this.reasonOptions.set([]),
    });
  }

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.employeeService.terminate(this.data.employee.id, this.data.kind, {
      terminationDate: toIsoDate(v.terminationDate)!,
      reasonCode: v.reasonCode!,
      notes: v.notes.trim() || null,
      rehireEligible: v.rehireEligible,
      finalPayRequired: v.finalPayRequired,
    }).subscribe({
      next: result => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(
          result.appliedAt ? 'employees.termination.done' : 'employees.termination.scheduledDone',
          { name: this.displayName }));
        this.dialogRef.close(result);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'employees.termination.failed');
      },
    });
  }
}
