import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe, CurrencyPipe } from '@angular/common';

import { ApprovalsService } from '../../services/approvals.service';
import { ApprovalRequest } from '../../models/approval.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';

@Component({
  selector: 'app-approval-inbox',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    DataTableComponent, ColumnCellDirective, DialogComponent,
    TextareaComponent, LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './approval-inbox.component.html',
  styleUrl: './approval-inbox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalInboxComponent implements OnInit {
  private readonly approvalsService = inject(ApprovalsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly pending = signal<ApprovalRequest[]>([]);
  protected readonly showRejectDialog = signal(false);
  protected readonly rejectTarget = signal<ApprovalRequest | null>(null);
  protected readonly rejectComments = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  protected readonly columns: ColumnDef[] = [
    { field: 'entityType', header: 'Type', sortable: true, width: '120px' },
    { field: 'entitySummary', header: 'Summary', sortable: true },
    { field: 'workflowName', header: 'Workflow', sortable: true, width: '150px' },
    { field: 'currentStepName', header: 'Step', sortable: true, width: '150px' },
    { field: 'amount', header: 'Amount', sortable: true, align: 'right', width: '100px' },
    { field: 'requestedByName', header: 'Requested By', sortable: true, width: '150px' },
    { field: 'requestedAt', header: 'Submitted', sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', width: '140px' },
  ];

  ngOnInit(): void {
    this.loadPending();
  }

  protected approve(request: ApprovalRequest): void {
    this.saving.set(true);
    this.approvalsService.approve(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.success('Approved');
          this.saving.set(false);
          this.loadPending();
        },
        error: () => this.saving.set(false),
      });
  }

  protected openReject(request: ApprovalRequest): void {
    this.rejectTarget.set(request);
    this.rejectComments.reset();
    this.showRejectDialog.set(true);
  }

  protected submitReject(): void {
    const target = this.rejectTarget();
    if (!target || this.rejectComments.invalid) return;
    this.saving.set(true);
    this.approvalsService.reject(target.id, this.rejectComments.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackbar.success('Rejected');
          this.showRejectDialog.set(false);
          this.saving.set(false);
          this.loadPending();
        },
        error: () => this.saving.set(false),
      });
  }

  private loadPending(): void {
    this.loading.set(true);
    this.approvalsService.getPendingApprovals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.pending.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
