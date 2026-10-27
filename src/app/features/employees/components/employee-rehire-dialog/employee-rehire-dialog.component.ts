import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

import { EmployeeService } from '../../services/employee.service';
import { EmployeeTerminateDialogData } from '../employee-terminate-dialog/employee-terminate-dialog-data.model';

@Component({
  selector: 'app-employee-rehire-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, DatepickerComponent],
  templateUrl: './employee-rehire-dialog.component.html',
  styleUrl: './employee-rehire-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeRehireDialogComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<EmployeeRehireDialogComponent, boolean>);
  protected readonly data = inject<EmployeeTerminateDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly applied = !!this.data.employee.termination?.appliedAt;
  protected readonly displayName = `${this.data.employee.lastName}, ${this.data.employee.firstName}`;

  protected readonly form = new FormGroup({
    rehireDate: new FormControl<Date | null>(null),
  });

  protected close(): void {
    this.dialogRef.close(false);
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.employeeService.rehire(this.data.employee.id, this.data.kind, toIsoDate(this.form.controls.rehireDate.value)).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(
          this.applied ? 'employees.termination.rehired' : 'employees.termination.cancelled', { name: this.displayName }));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'employees.termination.rehireFailed');
      },
    });
  }
}
