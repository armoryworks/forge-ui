import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

import { EmployeeService } from '../../services/employee.service';
import { CreatedEmployee } from '../../models/created-employee.model';

@Component({
  selector: 'app-employee-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, DatepickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './employee-create-dialog.component.html',
  styleUrl: './employee-create-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeCreateDialogComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<EmployeeCreateDialogComponent, CreatedEmployee | null>);

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    firstName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    lastName: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    hireDate: new FormControl<Date | null>(null),
    department: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    jobTitle: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    employeeNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    workEmail: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(256)] }),
    phoneNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    firstName: this.translate.instant('employees.create.firstName'),
    lastName: this.translate.instant('employees.create.lastName'),
    department: this.translate.instant('employees.create.department'),
    jobTitle: this.translate.instant('employees.create.jobTitle'),
    employeeNumber: this.translate.instant('employees.create.employeeNumber'),
    workEmail: this.translate.instant('employees.create.workEmail'),
    phoneNumber: this.translate.instant('employees.create.phone'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const optional = (value: string): string | null => value.trim() || null;
    this.employeeService.createEmployee({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      hireDate: toIsoDate(v.hireDate),
      department: optional(v.department),
      jobTitle: optional(v.jobTitle),
      employeeNumber: optional(v.employeeNumber),
      workEmail: optional(v.workEmail),
      phoneNumber: optional(v.phoneNumber),
    }).subscribe({
      next: created => {
        this.saving.set(false);
        this.snackbar.success(
          this.translate.instant('employees.create.created', { name: `${v.lastName.trim()}, ${v.firstName.trim()}` }),
        );
        this.dialogRef.close(created);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'employees.create.failed');
      },
    });
  }
}
