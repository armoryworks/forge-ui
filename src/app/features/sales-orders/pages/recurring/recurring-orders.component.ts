import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RecurringOrdersService } from '../../services/recurring-orders.service';
import { CreateRecurringOrderRequest, RecurringOrderListItem } from '../../models/recurring-order.model';
import { RecurringOrderDialogComponent } from '../../components/recurring-order-dialog/recurring-order-dialog.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * Recurring sales-order templates. The nightly RecurringOrderJob spins
 * each due template into a fresh SalesOrder + lines; this page is where
 * admins/managers create/manage those templates.
 *
 * Each row can be paused (the job skips it) and resumed; resuming a
 * template whose next run has passed moves that run forward to today or
 * later instead of generating catch-up orders.
 */
@Component({
  selector: 'app-recurring-orders',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe, MatTooltipModule,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './recurring-orders.component.html',
  styleUrl: './recurring-orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurringOrdersComponent {
  private readonly service = inject(RecurringOrdersService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<RecurringOrderListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly togglingId = signal<number | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('salesOrders.recurring.colName'), sortable: true },
    { field: 'customerName', header: this.translate.instant('salesOrders.recurring.colCustomer'), sortable: true },
    { field: 'intervalDays', header: this.translate.instant('salesOrders.recurring.colInterval'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'nextGenerationDate', header: this.translate.instant('salesOrders.recurring.colNextRun'), sortable: true, type: 'date', width: '130px' },
    { field: 'lastGeneratedDate', header: this.translate.instant('salesOrders.recurring.colLastRun'), sortable: true, type: 'date', width: '130px' },
    { field: 'lineCount', header: this.translate.instant('salesOrders.recurring.colLines'), sortable: true, type: 'number', align: 'right', width: '80px' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '90px', align: 'center' },
    { field: 'actions', header: '', width: '120px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.rows.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openNew(): void {
    this.dialog.open<RecurringOrderDialogComponent, void, CreateRecurringOrderRequest | undefined>(
      RecurringOrderDialogComponent, { width: '720px', maxWidth: '95vw' },
    ).afterClosed().subscribe(payload => {
      if (!payload) return;
      this.service.create(payload).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('salesOrders.recurring.created'));
          this.load();
        },
      });
    });
  }

  protected toggleActive(row: RecurringOrderListItem): void {
    if (this.togglingId() !== null) return;
    this.togglingId.set(row.id);
    const call = row.isActive ? this.service.deactivate(row.id) : this.service.activate(row.id);
    call.subscribe({
      next: (detail) => {
        this.togglingId.set(null);
        this.rows.update(rows => rows.map(r => r.id === row.id
          ? { ...r, isActive: detail.isActive, nextGenerationDate: detail.nextGenerationDate }
          : r));
        this.snackbar.success(this.translate.instant(
          detail.isActive ? 'salesOrders.recurring.resumed' : 'salesOrders.recurring.paused', { name: row.name }));
      },
      error: () => this.togglingId.set(null),
    });
  }

  protected confirmDelete(row: RecurringOrderListItem): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('salesOrders.recurring.deleteTitle'),
        message: this.translate.instant('salesOrders.recurring.deleteMessage', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.delete(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('salesOrders.recurring.deleted'));
          this.load();
        },
      });
    });
  }
}
