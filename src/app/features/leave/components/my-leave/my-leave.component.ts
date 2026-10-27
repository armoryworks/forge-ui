import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { merge } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { LeaveBalance } from '../../models/leave-balance.model';
import { LeavePolicy } from '../../models/leave-policy.model';
import { LeaveRequest } from '../../models/leave-request.model';
import { LeaveService } from '../../services/leave.service';
import { leaveWorkdayHours } from '../../utils/leave-workday-hours';
import { leaveStatusChip } from '../../utils/leave-status-chip';

function endOnOrAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  return start && end && end.getTime() < start.getTime() ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-my-leave',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, SelectComponent, DatepickerComponent,
    InputComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './my-leave.component.html',
  styleUrl: './my-leave.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyLeaveComponent {
  private readonly service = inject(LeaveService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly balances = signal<LeaveBalance[]>([]);
  protected readonly requests = signal<LeaveRequest[]>([]);
  protected readonly policies = signal<LeavePolicy[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showRequestDialog = signal(false);

  protected readonly policyOptions = computed<SelectOption[]>(() =>
    this.policies().map(p => ({ value: p.id, label: p.name })));
  protected readonly pendingHours = computed(() =>
    this.requests().filter(r => r.status === 'Pending').reduce((sum, r) => sum + r.hours, 0));

  protected readonly form = new FormGroup({
    policyId: new FormControl<number | null>(null, [Validators.required]),
    startDate: new FormControl<Date | null>(null, [Validators.required]),
    endDate: new FormControl<Date | null>(null, [Validators.required]),
    hours: new FormControl<number | null>(null, [Validators.required, Validators.min(0.25), Validators.max(2000)]),
    reason: new FormControl('', [Validators.maxLength(1000)]),
  }, { validators: endOnOrAfterStart });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    policyId: this.translate.instant('leave.fields.type'),
    startDate: this.translate.instant('leave.fields.startDate'),
    endDate: this.translate.instant('leave.fields.endDate'),
    hours: this.translate.instant('leave.fields.hours'),
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'startDate', header: this.translate.instant('leave.fields.startDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'endDate', header: this.translate.instant('leave.fields.endDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'policyName', header: this.translate.instant('leave.fields.type'), sortable: true },
    { field: 'hours', header: this.translate.instant('leave.fields.hours'), sortable: true, align: 'right', width: '90px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'approvedByName', header: this.translate.instant('leave.fields.decidedBy') },
    { field: 'denialReason', header: this.translate.instant('leave.fields.note') },
    { field: 'actions', header: '', width: '64px', align: 'right' },
  ];

  protected readonly rows = computed(() =>
    this.requests().map(r => ({ ...r, chipClass: leaveStatusChip(r.status) })));

  constructor() {
    this.load();
    merge(this.form.controls.startDate.valueChanges, this.form.controls.endDate.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.suggestHours());
  }

  protected load(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    this.loading.set(true);
    this.service.getBalances(userId).subscribe({
      next: balances => this.balances.set(balances),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'leave.loadFailed'),
    });
    this.service.getRequests(userId).subscribe({
      next: requests => { this.requests.set(requests); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.service.getPolicies().subscribe({
      next: policies => this.policies.set(policies),
      error: () => undefined,
    });
  }

  protected openRequest(): void {
    this.form.reset({
      policyId: this.policies().length === 1 ? this.policies()[0].id : null,
      startDate: null, endDate: null, hours: null, reason: '',
    });
    this.showRequestDialog.set(true);
  }

  protected closeRequest(): void {
    this.showRequestDialog.set(false);
  }

  private suggestHours(): void {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value ?? start;
    if (!start || !end || this.form.controls.hours.dirty) return;
    const hours = leaveWorkdayHours(start, end);
    if (hours > 0) this.form.controls.hours.setValue(hours, { emitEvent: false });
  }

  protected submitRequest(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.service.createRequest({
      policyId: v.policyId!,
      startDate: toDateOnly(v.startDate)!,
      endDate: toDateOnly(v.endDate)!,
      hours: Number(v.hours),
      reason: v.reason?.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeRequest();
        this.snackbar.success(this.translate.instant('leave.requestSubmitted'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'leave.requestFailed');
      },
    });
  }

  protected cancelRequest(request: LeaveRequest): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('leave.cancelTitle'),
        message: this.translate.instant('leave.cancelMessage', { hours: request.hours, type: request.policyName }),
        confirmLabel: this.translate.instant('leave.cancelRequest'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.cancelRequest(request.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('leave.requestCancelled'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'leave.cancelFailed'),
      });
    });
  }
}
