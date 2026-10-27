import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { startWith } from 'rxjs';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { fromIsoDate, toIsoDate } from '../../../../shared/utils/date.utils';
import { EmployeeService } from '../../../employees/services/employee.service';

import { ReviewsService } from '../../services/reviews.service';
import { ReviewCycle } from '../../models/review-cycle.model';
import { ReviewScopeType } from '../../models/review-scope-type.type';
import { SaveReviewCycleRequest } from '../../models/save-review-cycle-request.model';

export const RATING_SCALES: readonly number[] = [3, 4, 5, 7, 10];

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  return start && end && end.getTime() <= start.getTime() ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-review-cycle-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, DatepickerComponent, InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './review-cycle-dialog.component.html',
  styleUrl: './review-cycle-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCycleDialogComponent {
  private readonly reviews = inject(ReviewsService);
  private readonly employees = inject(EmployeeService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<ReviewCycleDialogComponent, ReviewCycle | null>);
  protected readonly cycle = inject<ReviewCycle | null>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.cycle;
  protected readonly scopeLocked = !!this.cycle && this.cycle.status !== 'Draft';
  protected readonly employeeOptions = signal<SelectOption[]>([]);

  protected readonly scaleOptions: SelectOption[] = RATING_SCALES.map(n => ({ value: n, label: `1 – ${n}` }));
  protected readonly scopeOptions: SelectOption[] = [
    { value: 'all', label: this.translate.instant('reviews.cycles.scope.all') },
    { value: 'department', label: this.translate.instant('reviews.cycles.scope.department') },
    { value: 'list', label: this.translate.instant('reviews.cycles.scope.list') },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl(this.cycle?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    startDate: new FormControl<Date | null>(fromIsoDate(this.cycle?.startDate), { validators: [Validators.required] }),
    endDate: new FormControl<Date | null>(fromIsoDate(this.cycle?.endDate), { validators: [Validators.required] }),
    description: new FormControl(this.cycle?.description ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    ratingScaleMax: new FormControl<number>(this.cycle?.ratingScaleMax ?? 5, { nonNullable: true }),
    competencies: new FormControl((this.cycle?.competencies ?? []).join('\n'), { nonNullable: true }),
    scopeType: new FormControl<ReviewScopeType>(this.cycle?.scopeType ?? 'all', { nonNullable: true }),
    scopeDepartment: new FormControl(this.cycle?.scopeDepartment ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    scopeUserIds: new FormControl<number[]>(this.cycle?.scopeUserIds ?? [], { nonNullable: true }),
  }, { validators: endAfterStart });

  private readonly scopeType = toSignal(
    this.form.controls.scopeType.valueChanges.pipe(startWith(this.form.controls.scopeType.value)),
    { initialValue: this.form.controls.scopeType.value },
  );
  protected readonly showDepartment = computed(() => this.scopeType() === 'department');
  protected readonly showEmployees = computed(() => this.scopeType() === 'list');

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('reviews.cycles.form.name'),
    startDate: this.translate.instant('reviews.cycles.form.startDate'),
    endDate: this.translate.instant('reviews.cycles.form.endDate'),
    description: this.translate.instant('reviews.cycles.form.description'),
    scopeDepartment: this.translate.instant('reviews.cycles.form.department'),
  });

  constructor() {
    if (this.scopeLocked) {
      this.form.controls.ratingScaleMax.disable();
      this.form.controls.competencies.disable();
      this.form.controls.scopeType.disable();
      this.form.controls.scopeDepartment.disable();
      this.form.controls.scopeUserIds.disable();
    }
    this.employees.getEmployees({ isActive: true }).subscribe({
      next: list => this.employeeOptions.set(list
        .filter(e => e.hasLogin !== false)
        .map(e => ({ value: e.id, label: `${e.lastName}, ${e.firstName}` }))),
      error: () => this.employeeOptions.set([]),
    });
  }

  protected close(): void {
    this.dialogRef.close(null);
  }

  protected buildRequest(): SaveReviewCycleRequest {
    const v = this.form.getRawValue();
    return {
      name: v.name.trim(),
      startDate: toIsoDate(v.startDate)!,
      endDate: toIsoDate(v.endDate)!,
      description: v.description.trim() || null,
      ratingScaleMax: v.ratingScaleMax,
      competencies: v.competencies.split('\n').map(c => c.trim()).filter(c => c.length > 0),
      scopeType: v.scopeType,
      scopeDepartment: v.scopeType === 'department' ? v.scopeDepartment.trim() || null : null,
      scopeUserIds: v.scopeType === 'list' ? v.scopeUserIds : null,
    };
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const request = this.buildRequest();
    if (request.scopeType === 'department' && !request.scopeDepartment) {
      this.snackbar.error(this.translate.instant('reviews.cycles.form.departmentRequired'));
      return;
    }
    if (request.scopeType === 'list' && !request.scopeUserIds?.length) {
      this.snackbar.error(this.translate.instant('reviews.cycles.form.employeesRequired'));
      return;
    }
    this.saving.set(true);
    const call = this.cycle ? this.reviews.updateCycle(this.cycle.id, request) : this.reviews.createCycle(request);
    call.subscribe({
      next: saved => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('reviews.cycles.saved', { name: saved.name }));
        this.dialogRef.close(saved);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'reviews.cycles.saveFailed');
      },
    });
  }
}
