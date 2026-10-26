import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PaymentRunService } from '../../services/payment-run.service';
import { PaymentRunListItem } from '../../models/payment-run-list-item.model';
import { PaymentRunDetailDialogData } from '../../models/payment-run-detail-dialog-data.model';
import { vendorCreditStatusChip } from '../../vendor-credit-status';
import { PAYABLES_MANAGE_ROLES } from '../../payables-roles';
import { PaymentRunDetailDialogComponent } from '../payment-run-detail-dialog/payment-run-detail-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';

/** Payables > Payment runs: every run with its per-bill status; an interrupted run can be resumed or cancelled. */
@Component({
  selector: 'app-payment-runs-panel',
  standalone: true,
  imports: [MatTooltipModule, TranslatePipe, DateOnlyPipe, DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, LoadingBlockDirective],
  templateUrl: './payment-runs-panel.component.html',
  styleUrl: './payment-runs-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentRunsPanelComponent {
  private readonly service = inject(PaymentRunService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly canManage = inject(AuthService).hasAnyRole(PAYABLES_MANAGE_ROLES);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly runs = signal<PaymentRunListItem[]>([]);

  protected readonly columns: ColumnDef[] = [
    { field: 'runNumber', header: this.translate.instant('paymentRuns.number'), sortable: true, width: '120px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '130px' },
    { field: 'paymentDate', header: this.translate.instant('common.date'), sortable: true, type: 'date', width: '110px' },
    { field: 'method', header: this.translate.instant('payables.method'), sortable: true, width: '110px' },
    { field: 'progress', header: this.translate.instant('paymentRuns.progress'), width: '160px' },
    { field: 'cashTotal', header: this.translate.instant('paymentTerms.cashTotal'), sortable: true, width: '120px', align: 'right' },
    { field: 'creditTotal', header: this.translate.instant('paymentRuns.creditTotal'), sortable: true, width: '120px', align: 'right' },
    { field: 'actions', header: this.translate.instant('common.actions'), width: '110px', align: 'right' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getRuns().subscribe({
      next: list => {
        this.runs.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusClass(status: string): string {
    return vendorCreditStatusChip(status);
  }

  protected openDetail(run: PaymentRunListItem): void {
    this.dialog.open<PaymentRunDetailDialogComponent, PaymentRunDetailDialogData, boolean>(PaymentRunDetailDialogComponent, {
      width: '760px', data: { runId: run.id },
    }).afterClosed().subscribe(changed => {
      if (changed) this.load();
    });
  }

  protected resume(run: PaymentRunListItem): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.service.resume(run.id).subscribe({
      next: resumed => {
        this.busy.set(false);
        this.snackbar.success(this.translate.instant(resumed.status === 'Completed' ? 'paymentRuns.resumed' : 'paymentRuns.stillInterrupted',
          { number: resumed.runNumber }));
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  protected cancel(run: PaymentRunListItem): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('paymentRuns.cancelTitle'),
        message: this.translate.instant('paymentRuns.cancelMessage', { number: run.runNumber, count: run.pendingCount + run.failedCount }),
        confirmLabel: this.translate.instant('paymentRuns.cancelRun'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.cancel(run.id).subscribe({ next: () => this.load() });
    });
  }
}
