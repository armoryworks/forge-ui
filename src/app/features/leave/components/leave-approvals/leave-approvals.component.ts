import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LeaveRequest } from '../../models/leave-request.model';
import { LeaveRequestStatus } from '../../models/leave-request-status.type';
import { LeaveService } from '../../services/leave.service';
import { leaveStatusChip } from '../../utils/leave-status-chip';

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DecimalPipe,
    DataTableComponent, ColumnCellDirective, DialogComponent, SelectComponent, TextareaComponent,
  ],
  templateUrl: './leave-approvals.component.html',
  styleUrl: './leave-approvals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveApprovalsComponent {
  private readonly service = inject(LeaveService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canDecide = input(false);

  protected readonly requests = signal<LeaveRequest[]>([]);
  protected readonly loading = signal(false);
  protected readonly deciding = signal(false);
  protected readonly denyTarget = signal<LeaveRequest | null>(null);

  protected readonly statusControl = new FormControl<LeaveRequestStatus | ''>('Pending', { nonNullable: true });
  protected readonly denyNoteControl = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] });

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('leave.status.all') },
    { value: 'Pending', label: this.translate.instant('leave.status.Pending') },
    { value: 'Approved', label: this.translate.instant('leave.status.Approved') },
    { value: 'Denied', label: this.translate.instant('leave.status.Denied') },
    { value: 'Cancelled', label: this.translate.instant('leave.status.Cancelled') },
  ];

  protected readonly rows = computed(() => {
    const me = this.auth.user()?.id;
    const decide = this.canDecide();
    return this.requests().map(r => ({
      ...r,
      chipClass: leaveStatusChip(r.status),
      actionable: decide && r.status === 'Pending',
      isOwn: r.userId === me,
    }));
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'userName', header: this.translate.instant('leave.fields.employee'), sortable: true },
    { field: 'policyName', header: this.translate.instant('leave.fields.type'), sortable: true },
    { field: 'startDate', header: this.translate.instant('leave.fields.startDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'endDate', header: this.translate.instant('leave.fields.endDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'hours', header: this.translate.instant('leave.fields.hours'), sortable: true, align: 'right', width: '90px' },
    { field: 'reason', header: this.translate.instant('leave.fields.reason') },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '120px' },
    { field: 'approvedByName', header: this.translate.instant('leave.fields.decidedBy') },
    { field: 'actions', header: '', width: '96px', align: 'right' },
  ];

  constructor() {
    this.load();
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getRequests(null, this.statusControl.value || null).subscribe({
      next: requests => { this.requests.set(requests); this.loading.set(false); },
      error: (err: unknown) => { this.loading.set(false); this.snackbar.errorFrom(err, 'leave.loadFailed'); },
    });
  }

  protected approve(request: LeaveRequest): void {
    if (this.deciding()) return;
    this.deciding.set(true);
    this.service.approveRequest(request.id).subscribe({
      next: () => {
        this.deciding.set(false);
        this.snackbar.success(this.translate.instant('leave.approved', { name: request.userName }));
        this.load();
      },
      error: (err: unknown) => { this.deciding.set(false); this.snackbar.errorFrom(err, 'leave.decideFailed'); },
    });
  }

  protected openDeny(request: LeaveRequest): void {
    this.denyNoteControl.reset('');
    this.denyTarget.set(request);
  }

  protected closeDeny(): void {
    this.denyTarget.set(null);
  }

  protected deny(): void {
    const target = this.denyTarget();
    if (!target || this.deciding() || this.denyNoteControl.invalid) return;
    this.deciding.set(true);
    this.service.denyRequest(target.id, this.denyNoteControl.value.trim() || null).subscribe({
      next: () => {
        this.deciding.set(false);
        this.closeDeny();
        this.snackbar.success(this.translate.instant('leave.denied', { name: target.userName }));
        this.load();
      },
      error: (err: unknown) => { this.deciding.set(false); this.snackbar.errorFrom(err, 'leave.decideFailed'); },
    });
  }
}
