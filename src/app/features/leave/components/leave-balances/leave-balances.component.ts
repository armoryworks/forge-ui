import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { LeaveAdjustmentType } from '../../models/leave-adjustment-type.type';
import { LeaveBalance } from '../../models/leave-balance.model';
import { LeaveBalanceAdjustment } from '../../models/leave-balance-adjustment.model';
import { LeavePolicy } from '../../models/leave-policy.model';
import { LeaveUser } from '../../models/leave-user.model';
import { LeaveService } from '../../services/leave.service';

@Component({
  selector: 'app-leave-balances',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, SelectComponent, DatepickerComponent,
    InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './leave-balances.component.html',
  styleUrl: './leave-balances.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveBalancesComponent {
  private readonly service = inject(LeaveService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly canAdjust = input(false);

  protected readonly balances = signal<LeaveBalance[]>([]);
  protected readonly policies = signal<LeavePolicy[]>([]);
  protected readonly users = signal<LeaveUser[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showAdjustDialog = signal(false);
  protected readonly historyFor = signal<{ userId: number; name: string } | null>(null);
  protected readonly history = signal<LeaveBalanceAdjustment[]>([]);

  protected readonly userOptions = computed<SelectOption[]>(() => this.users().map(u => ({ value: u.id, label: u.name })));
  protected readonly policyOptions = computed<SelectOption[]>(() => this.policies().map(p => ({ value: p.id, label: p.name })));
  protected readonly typeOptions: SelectOption[] = [
    { value: 'Opening', label: this.translate.instant('leave.adjustmentType.Opening') },
    { value: 'Adjustment', label: this.translate.instant('leave.adjustmentType.Adjustment') },
  ];

  protected readonly form = new FormGroup({
    userId: new FormControl<number | null>(null, [Validators.required]),
    policyId: new FormControl<number | null>(null, [Validators.required]),
    type: new FormControl<LeaveAdjustmentType>('Opening', { nonNullable: true, validators: [Validators.required] }),
    hours: new FormControl<number | null>(null, [Validators.required, Validators.min(-9999), Validators.max(9999)]),
    effectiveDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())));
  private readonly fieldViolations = FormValidationService.getViolations(this.form, {
    userId: this.translate.instant('leave.fields.employee'),
    policyId: this.translate.instant('leave.fields.type'),
    hours: this.translate.instant('leave.fields.hours'),
    effectiveDate: this.translate.instant('leave.fields.effectiveDate'),
  });
  protected readonly isOpening = computed(() => this.formValue()?.type === 'Opening');
  protected readonly ruleViolations = computed(() => {
    const v = this.formValue();
    const issues: string[] = [];
    const hours = Number(v?.hours);
    if (v?.type === 'Opening' && v.hours !== null && hours < 0) issues.push(this.translate.instant('leave.openingNotNegative'));
    if (v?.type === 'Adjustment' && v.hours !== null && hours === 0) issues.push(this.translate.instant('leave.adjustmentNotZero'));
    if (v?.type === 'Adjustment' && !v.reason?.trim()) issues.push(this.translate.instant('leave.adjustmentNeedsReason'));
    return issues;
  });
  protected readonly violations = computed(() => [...this.fieldViolations(), ...this.ruleViolations()]);

  protected readonly columns: ColumnDef[] = [
    { field: 'userName', header: this.translate.instant('leave.fields.employee'), sortable: true },
    { field: 'policyName', header: this.translate.instant('leave.fields.type'), sortable: true },
    { field: 'balance', header: this.translate.instant('leave.fields.balance'), sortable: true, align: 'right', width: '100px' },
    { field: 'usedThisYear', header: this.translate.instant('leave.fields.used'), sortable: true, align: 'right', width: '100px' },
    { field: 'accruedThisYear', header: this.translate.instant('leave.fields.accrued'), sortable: true, align: 'right', width: '100px' },
    { field: 'lastAccrualDate', header: this.translate.instant('leave.fields.lastAccrual'), sortable: true, type: 'date', width: '130px' },
    { field: 'actions', header: '', width: '96px', align: 'right' },
  ];

  protected readonly historyColumns: ColumnDef[] = [
    { field: 'effectiveDate', header: this.translate.instant('leave.fields.effectiveDate'), type: 'date', width: '120px' },
    { field: 'policyName', header: this.translate.instant('leave.fields.type') },
    { field: 'type', header: this.translate.instant('leave.fields.adjustmentType'), width: '120px' },
    { field: 'hours', header: this.translate.instant('leave.fields.hours'), align: 'right', width: '80px' },
    { field: 'balanceAfter', header: this.translate.instant('leave.fields.balanceAfter'), align: 'right', width: '100px' },
    { field: 'reason', header: this.translate.instant('leave.fields.reason') },
    { field: 'createdByName', header: this.translate.instant('leave.fields.recordedBy') },
  ];

  constructor() {
    this.load();
    this.service.getPolicies().subscribe({ next: p => this.policies.set(p), error: () => undefined });
    this.service.getUsers().subscribe({ next: u => this.users.set(u), error: () => undefined });
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getAllBalances().subscribe({
      next: balances => { this.balances.set(balances); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'leave.loadFailed'); },
    });
  }

  protected openAdjust(row?: LeaveBalance): void {
    this.form.reset({
      userId: row?.userId ?? null,
      policyId: row?.policyId ?? (this.policies().length === 1 ? this.policies()[0].id : null),
      type: row ? 'Adjustment' : 'Opening',
      hours: null,
      effectiveDate: new Date(),
      reason: '',
    });
    this.showAdjustDialog.set(true);
  }

  protected closeAdjust(): void {
    this.showAdjustDialog.set(false);
  }

  protected saveAdjustment(): void {
    if (this.form.invalid || this.ruleViolations().length > 0 || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.service.adjustBalance(v.userId!, {
      policyId: v.policyId!,
      type: v.type,
      hours: Number(v.hours),
      effectiveDate: toDateOnly(v.effectiveDate)!,
      reason: v.reason.trim() || null,
    }).subscribe({
      next: result => {
        this.saving.set(false);
        this.closeAdjust();
        this.snackbar.success(this.translate.instant('leave.adjusted', { hours: result.balanceAfter, type: result.policyName }));
        this.load();
      },
      error: (err: unknown) => { this.saving.set(false); this.snackbar.errorFrom(err, 'leave.adjustFailed'); },
    });
  }

  protected openHistory(row: LeaveBalance): void {
    this.history.set([]);
    this.historyFor.set({ userId: row.userId, name: row.userName ?? '' });
    this.service.getAdjustments(row.userId).subscribe({
      next: rows => this.history.set(rows),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'leave.loadFailed'),
    });
  }

  protected closeHistory(): void {
    this.historyFor.set(null);
  }
}
