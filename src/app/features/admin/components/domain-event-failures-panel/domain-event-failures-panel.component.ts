import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../../services/admin.service';
import { DomainEventFailure } from '../../models/domain-event-failure.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-domain-event-failures-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    TranslatePipe,
    MatTooltipModule,
    DataTableComponent,
    ColumnCellDirective,
    SelectComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './domain-event-failures-panel.component.html',
  styleUrl: './domain-event-failures-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DomainEventFailuresPanelComponent {
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(false);
  protected readonly failures = signal<DomainEventFailure[]>([]);
  protected readonly expandedId = signal<number | null>(null);

  protected readonly statusControl = new FormControl<string>('');

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('adminPanels.domainEventFailures.allStatuses') },
    { value: 'Failed', label: this.translate.instant('adminPanels.domainEventFailures.statusFailed') },
    { value: 'Retrying', label: this.translate.instant('adminPanels.domainEventFailures.statusRetrying') },
    { value: 'Resolved', label: this.translate.instant('adminPanels.domainEventFailures.statusResolved') },
  ];

  protected readonly filteredFailures = computed(() => {
    const status = this.statusControl.value;
    const all = this.failures();
    if (!status) return all;
    return all.filter(f => f.status === status);
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'eventType', header: this.translate.instant('adminPanels.domainEventFailures.cols.eventType'), sortable: true, width: '200px' },
    { field: 'handlerName', header: this.translate.instant('adminPanels.domainEventFailures.cols.handler'), sortable: true, width: '240px' },
    { field: 'errorMessage', header: this.translate.instant('adminPanels.domainEventFailures.cols.error'), sortable: false },
    { field: 'status', header: this.translate.instant('adminPanels.domainEventFailures.cols.status'), sortable: true, filterable: true, type: 'enum', width: '110px',
      filterOptions: [
        { value: 'Failed', label: 'Failed' },
        { value: 'Retrying', label: 'Retrying' },
        { value: 'Resolved', label: 'Resolved' },
      ],
    },
    { field: 'retryCount', header: this.translate.instant('adminPanels.domainEventFailures.cols.retries'), sortable: true, width: '80px', align: 'right' },
    { field: 'failedAt', header: this.translate.instant('adminPanels.domainEventFailures.cols.failedAt'), sortable: true, type: 'date', width: '150px' },
    { field: 'lastRetryAt', header: this.translate.instant('adminPanels.domainEventFailures.cols.lastRetry'), sortable: true, type: 'date', width: '150px' },
    { field: 'actions', header: '', width: '100px', sortable: false },
  ];

  constructor() {
    this.load();
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      // Filtering is handled by computed signal, no reload needed
    });
  }

  protected load(): void {
    this.isLoading.set(true);
    this.adminService.getDomainEventFailures().subscribe({
      next: (data) => {
        this.failures.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  protected toggleDetail(failure: DomainEventFailure): void {
    this.expandedId.set(this.expandedId() === failure.id ? null : failure.id);
  }

  protected retryFailure(failure: DomainEventFailure, event: Event): void {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('adminPanels.domainEventFailures.retryTitle'),
        message: this.translate.instant('adminPanels.domainEventFailures.retryMessage', { handler: failure.handlerName }),
        confirmLabel: this.translate.instant('adminPanels.domainEventFailures.retry'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.adminService.retryDomainEventFailure(failure.id).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('adminPanels.domainEventFailures.retryQueued'));
            this.load();
          },
        });
      }
    });
  }

  protected resolveFailure(failure: DomainEventFailure, event: Event): void {
    event.stopPropagation();
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('adminPanels.domainEventFailures.resolveTitle'),
        message: this.translate.instant('adminPanels.domainEventFailures.resolveMessage', { handler: failure.handlerName }),
        confirmLabel: this.translate.instant('adminPanels.domainEventFailures.resolve'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.adminService.resolveDomainEventFailure(failure.id).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('adminPanels.domainEventFailures.resolved'));
            this.load();
          },
        });
      }
    });
  }

  protected getStatusClass(status: string): string {
    switch (status) {
      case 'Failed': return 'chip--error';
      case 'Retrying': return 'chip--warning';
      case 'Resolved': return 'chip--success';
      default: return 'chip--muted';
    }
  }

  protected formatPayload(payload: string): string {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  }

  protected truncate(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}
