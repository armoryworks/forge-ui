import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { downloadCsv } from '../../../../shared/utils/download-csv';
import { PayRunService } from '../../services/pay-run.service';
import { PayRun } from '../../models/pay-run.model';
import { PayrollRegisterImportResult } from '../../models/payroll-register-import-result.model';
import { PAYROLL_REGISTER_TEMPLATE_EXAMPLE, PAYROLL_REGISTER_TEMPLATE_HEADER } from '../../utils/payroll-register-template';
import { PayrollImportDialogComponent, PayrollImportDialogData } from '../payroll-import-dialog/payroll-import-dialog.component';
import { PayRunPostDialogComponent, PayRunPostDialogData } from '../pay-run-post-dialog/pay-run-post-dialog.component';

const DEFAULT_BOOK_ID = 1;

/**
 * Phase-5 pay runs (CAP-PAYROLL-RUN): the book's pay runs with period, status, gross, net, employer taxes
 * and the posted journal; import a payroll provider's register as a Draft run (needs CAP-ACCT-FULLGL), and
 * post a Draft run after reviewing its journal lines. A CSV template shows the register layout the import reads.
 */
@Component({
  selector: 'app-pay-runs',
  standalone: true,
  imports: [TranslatePipe, CurrencyPipe, PageHeaderComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './pay-runs.component.html',
  styleUrl: './pay-runs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayRunsComponent implements OnInit {
  private readonly payRunService = inject(PayRunService);
  private readonly capabilities = inject(CapabilityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly payRuns = signal<PayRun[]>([]);
  protected readonly canImport = computed(() => {
    this.capabilities.capabilities();
    return this.capabilities.isEnabled('CAP-ACCT-FULLGL');
  });

  protected readonly columns: ColumnDef[] = [
    { field: 'payDate', header: this.translate.instant('accounting.payRuns.payDate'), sortable: true, width: '110px' },
    { field: 'period', header: this.translate.instant('accounting.payRuns.period'), width: '200px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '100px' },
    { field: 'grossWages', header: this.translate.instant('accounting.payRuns.gross'), sortable: true, align: 'right', width: '120px' },
    { field: 'netPay', header: this.translate.instant('accounting.payRuns.net'), sortable: true, align: 'right', width: '120px' },
    { field: 'employerTax', header: this.translate.instant('accounting.payRuns.employerTax'), align: 'right', width: '120px' },
    { field: 'journal', header: this.translate.instant('accounting.payRuns.journal'), width: '110px' },
    { field: 'actions', header: this.translate.instant('common.actions'), align: 'right', width: '110px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected downloadTemplate(): void {
    downloadCsv([[...PAYROLL_REGISTER_TEMPLATE_HEADER], [...PAYROLL_REGISTER_TEMPLATE_EXAMPLE]], 'payroll-register-template');
  }

  protected openImport(): void {
    this.dialog
      .open(PayrollImportDialogComponent, { width: '800px', data: { bookId: DEFAULT_BOOK_ID } satisfies PayrollImportDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: PayrollRegisterImportResult | undefined) => {
        if (!result) return;
        const message = this.translate.instant('accounting.payRuns.imported', { count: result.employeeCount });
        if (result.warnings.length > 0) {
          this.snackbar.info(`${message} ${this.translate.instant('accounting.payRuns.importWarnings', { count: result.warnings.length })}`);
        } else {
          this.snackbar.success(message);
        }
        this.load();
      });
  }

  protected openPost(payRun: PayRun): void {
    this.dialog
      .open(PayRunPostDialogComponent, { width: '640px', data: { payRun } satisfies PayRunPostDialogData })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((posted: PayRun | undefined) => {
        if (!posted) return;
        this.snackbar.success(this.translate.instant('accounting.payRuns.posted', { number: posted.journalEntryNumber ?? posted.journalEntryId ?? '' }));
        this.load();
      });
  }

  private load(): void {
    this.loading.set(true);
    this.payRunService.list(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (runs) => {
          this.payRuns.set(runs);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.payRuns.loadFailed');
        },
      });
  }
}
