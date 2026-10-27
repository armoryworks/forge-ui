import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeavePolicy } from '../../models/leave-policy.model';
import { LeavePolicyRequest } from '../../models/leave-policy-request.model';
import { LeaveService } from '../../services/leave.service';

@Component({
  selector: 'app-leave-policies',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, InputComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './leave-policies.component.html',
  styleUrl: './leave-policies.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeavePoliciesComponent {
  private readonly service = inject(LeaveService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly canEdit = input(false);

  protected readonly policies = signal<LeavePolicy[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly editing = signal<LeavePolicy | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    accrualRatePerPayPeriod: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
    maxBalance: new FormControl<number | null>(null, [Validators.min(0)]),
    carryOverLimit: new FormControl<number | null>(null, [Validators.min(0)]),
    waitingPeriodDays: new FormControl<number | null>(null, [Validators.min(0)]),
    accrueFromHireDate: new FormControl(true, { nonNullable: true }),
    isPaidLeave: new FormControl(true, { nonNullable: true }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('common.name'),
    accrualRatePerPayPeriod: this.translate.instant('leave.policy.accrualRate'),
    maxBalance: this.translate.instant('leave.policy.maxBalance'),
    carryOverLimit: this.translate.instant('leave.policy.carryOver'),
    waitingPeriodDays: this.translate.instant('leave.policy.waitingPeriod'),
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('common.name'), sortable: true },
    { field: 'accrualRatePerPayPeriod', header: this.translate.instant('leave.policy.accrualRate'), align: 'right', width: '150px' },
    { field: 'maxBalance', header: this.translate.instant('leave.policy.maxBalance'), align: 'right', width: '110px' },
    { field: 'carryOverLimit', header: this.translate.instant('leave.policy.carryOver'), align: 'right', width: '110px' },
    { field: 'waitingPeriodDays', header: this.translate.instant('leave.policy.waitingPeriod'), align: 'right', width: '120px' },
    { field: 'isPaidLeave', header: this.translate.instant('leave.policy.paid'), width: '80px' },
    { field: 'isActive', header: this.translate.instant('common.status'), width: '100px' },
    { field: 'actions', header: '', width: '56px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getPolicies(false).subscribe({
      next: policies => { this.policies.set(policies); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'leave.loadFailed'); },
    });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      name: '', accrualRatePerPayPeriod: 0, maxBalance: null, carryOverLimit: null, waitingPeriodDays: null,
      accrueFromHireDate: true, isPaidLeave: true, isActive: true,
    });
    this.showDialog.set(true);
  }

  protected openEdit(policy: LeavePolicy): void {
    this.editing.set(policy);
    this.form.reset({
      name: policy.name,
      accrualRatePerPayPeriod: policy.accrualRatePerPayPeriod,
      maxBalance: policy.maxBalance,
      carryOverLimit: policy.carryOverLimit,
      waitingPeriodDays: policy.waitingPeriodDays,
      accrueFromHireDate: policy.accrueFromHireDate,
      isPaidLeave: policy.isPaidLeave,
      isActive: policy.isActive,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const optional = (value: number | null) => (value === null || `${value}` === '' ? null : Number(value));
    const request: LeavePolicyRequest = {
      name: v.name.trim(),
      accrualRatePerPayPeriod: Number(v.accrualRatePerPayPeriod),
      maxBalance: optional(v.maxBalance),
      carryOverLimit: optional(v.carryOverLimit),
      waitingPeriodDays: optional(v.waitingPeriodDays),
      accrueFromHireDate: v.accrueFromHireDate,
      isPaidLeave: v.isPaidLeave,
      isActive: v.isActive,
    };
    const editing = this.editing();
    this.saving.set(true);
    (editing ? this.service.updatePolicy(editing.id, request) : this.service.createPolicy(request)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.snackbar.success(this.translate.instant('leave.policy.saved', { name: request.name }));
        this.load();
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'leave.policy.saveFailed'); },
    });
  }
}
