import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AdminService } from '../../services/admin.service';
import { OutboxEntry, OutboxProvider, OutboxStatus } from '../../models/outbox-entry.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-integration-outbox-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatTooltipModule,
    DataTableComponent,
    ColumnCellDirective,
    SelectComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './integration-outbox-panel.component.html',
  styleUrl: './integration-outbox-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationOutboxPanelComponent {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  protected readonly isLoading = signal(false);
  protected readonly entries = signal<OutboxEntry[]>([]);
  protected readonly expandedId = signal<number | null>(null);

  protected readonly statusControl = new FormControl<OutboxStatus | ''>('');
  protected readonly providerControl = new FormControl<OutboxProvider | ''>('');

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'InFlight', label: 'In Flight' },
    { value: 'Sent', label: 'Sent' },
    { value: 'Failed', label: 'Failed' },
    { value: 'DeadLetter', label: 'Dead Letter' },
  ];

  protected readonly providerOptions: SelectOption[] = [
    { value: '', label: 'All providers' },
    { value: 'Email', label: 'Email' },
    { value: 'DocuSeal', label: 'DocuSeal' },
    { value: 'QuickBooks', label: 'QuickBooks' },
    { value: 'Shipping', label: 'Shipping' },
    { value: 'Webhook', label: 'Webhook' },
    { value: 'Sms', label: 'SMS' },
  ];

  protected readonly filtered = computed(() => {
    const status = this.statusControl.value || '';
    const provider = this.providerControl.value || '';
    return this.entries().filter(e =>
      (!status || e.status === status) &&
      (!provider || e.provider === provider));
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'id', header: 'ID', sortable: true, width: '70px', align: 'right' },
    { field: 'provider', header: 'Provider', sortable: true, width: '110px' },
    { field: 'operationKey', header: 'Operation Key', sortable: true },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
    { field: 'attemptCount', header: 'Attempts', sortable: true, width: '90px', align: 'right' },
    { field: 'nextAttemptAt', header: 'Next Attempt', sortable: true, type: 'date', width: '150px' },
    { field: 'sentAt', header: 'Sent At', sortable: true, type: 'date', width: '150px' },
    { field: 'lastError', header: 'Last Error', sortable: false },
    { field: 'actions', header: '', width: '100px', sortable: false },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    this.adminService.getOutboxEntries().subscribe({
      next: data => {
        this.entries.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected toggleDetail(row: OutboxEntry): void {
    this.expandedId.set(this.expandedId() === row.id ? null : row.id);
  }

  protected retry(row: OutboxEntry, event: Event): void {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Retry outbox entry?',
        message: `Re-queue ${row.provider} entry "${row.operationKey}" for immediate dispatch?`,
        confirmLabel: 'Retry',
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.retryOutboxEntry(row.id).subscribe({
        next: () => {
          this.snackbar.success('Queued for retry');
          this.load();
        },
      });
    });
  }

  protected discard(row: OutboxEntry, event: Event): void {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Discard outbox entry?',
        message: `Mark ${row.provider} entry "${row.operationKey}" as dead-lettered. It will not be retried automatically.`,
        confirmLabel: 'Discard',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.adminService.discardOutboxEntry(row.id).subscribe({
        next: () => {
          this.snackbar.success('Entry discarded');
          this.load();
        },
      });
    });
  }

  protected statusClass(status: OutboxStatus): string {
    switch (status) {
      case 'Sent': return 'chip--success';
      case 'Pending': return 'chip--info';
      case 'InFlight': return 'chip--info';
      case 'Failed': return 'chip--warning';
      case 'DeadLetter': return 'chip--error';
      default: return 'chip--muted';
    }
  }

  protected truncate(text: string | null, max: number): string {
    if (!text) return '';
    return text.length <= max ? text : text.substring(0, max) + '...';
  }
}
