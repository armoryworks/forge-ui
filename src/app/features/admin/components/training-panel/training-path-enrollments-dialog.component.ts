import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { EmployeeService } from '../../../employees/services/employee.service';
import { TrainingEnrollmentService } from '../../../training/services/training-enrollment.service';
import { TrainingPathEnrollment } from '../../../training/models/training-path-enrollment.model';

import { TrainingPathEnrollmentsDialogData } from './training-path-enrollments-dialog-data.model';

const SERVICE_ROLES: ReadonlySet<string> = new Set(['LeadIntake', 'BiApiClient']);

@Component({
  selector: 'app-training-path-enrollments-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DialogComponent, DatepickerComponent, SelectComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
  ],
  templateUrl: './training-path-enrollments-dialog.component.html',
  styleUrl: './training-path-enrollments-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPathEnrollmentsDialogComponent {
  private readonly enrollments = inject(TrainingEnrollmentService);
  private readonly employees = inject(EmployeeService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<TrainingPathEnrollmentsDialogComponent>);
  protected readonly data = inject<TrainingPathEnrollmentsDialogData>(MAT_DIALOG_DATA);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly rows = signal<TrainingPathEnrollment[]>([]);
  protected readonly userOptions = signal<SelectOption[]>([]);
  protected readonly roleOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    userIds: new FormControl<number[]>([], { nonNullable: true }),
    roles: new FormControl<string[]>([], { nonNullable: true }),
    dueDate: new FormControl<Date | null>(null),
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'userName', header: 'adminPanels.training.enrollments.cols.user', sortable: true },
    { field: 'enrolledAt', header: 'adminPanels.training.enrollments.cols.enrolled', sortable: true, width: '110px' },
    { field: 'dueDate', header: 'adminPanels.training.enrollments.cols.due', sortable: true, width: '130px' },
    { field: 'progressPercent', header: 'adminPanels.training.enrollments.cols.progress', sortable: true, width: '120px', align: 'right' },
    { field: 'actions', header: '', width: '170px', align: 'right' },
  ];

  constructor() {
    this.load();
    if (this.data.canEdit) {
      this.employees.getEmployees({ isActive: true }).subscribe({
        next: list => this.userOptions.set(list
          .filter(e => e.hasLogin !== false)
          .map(e => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))),
        error: () => this.userOptions.set([]),
      });
      this.referenceData.getRolesAsOptions().subscribe({
        next: roles => this.roleOptions.set(roles.filter(r => r.value !== null && !SERVICE_ROLES.has(r.value as string))),
        error: () => this.roleOptions.set([]),
      });
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.enrollments.getPathEnrollments(this.data.pathId).subscribe({
      next: rows => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected enroll(): void {
    const v = this.form.getRawValue();
    if (this.saving() || (v.userIds.length === 0 && v.roles.length === 0)) return;
    this.saving.set(true);
    this.enrollments.enroll(this.data.pathId, { userIds: v.userIds, roles: v.roles, dueDate: toIsoDate(v.dueDate) }).subscribe({
      next: result => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('adminPanels.training.enrollments.enrolled',
          { count: result.enrolled, already: result.alreadyEnrolled }));
        this.form.reset({ userIds: [], roles: [], dueDate: null });
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'adminPanels.training.enrollments.enrollFailed');
      },
    });
  }

  protected applyDueDate(row: TrainingPathEnrollment): void {
    this.enrollments.setDueDate(row.id, toIsoDate(this.form.controls.dueDate.value)).subscribe({
      next: () => this.load(),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'adminPanels.training.enrollments.updateFailed'),
    });
  }

  protected remove(row: TrainingPathEnrollment): void {
    this.enrollments.remove(row.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('adminPanels.training.enrollments.removed', { name: row.userName }));
        this.load();
      },
      error: (err: unknown) => this.snackbar.errorFrom(err, 'adminPanels.training.enrollments.updateFailed'),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
