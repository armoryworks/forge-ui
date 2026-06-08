import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { FiscalPeriodStatus, FiscalYearModel } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-period-close',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ColumnCellDirective],
  templateUrl: './period-close.component.html',
  styleUrl: './period-close.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodCloseComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly years = signal<FiscalYearModel[]>([]);

  protected readonly periodColumns: ColumnDef[] = [
    { field: 'periodNumber', header: '#', sortable: true, type: 'number', align: 'right', width: '60px' },
    { field: 'name', header: 'Period', sortable: true },
    { field: 'dates', header: 'Dates', width: '220px' },
    { field: 'status', header: 'Status', sortable: true, width: '130px' },
    { field: 'actions', header: 'Actions', align: 'right', width: '240px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getFiscalCalendar(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (y) => {
          this.years.set(y);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load the fiscal calendar.');
          this.loading.set(false);
        },
      });
  }

  protected setPeriod(periodId: number, target: FiscalPeriodStatus): void {
    this.run(this.gl.setPeriodStatus(periodId, target));
  }

  protected closeYear(fiscalYearId: number): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: 'Close fiscal year?',
          message: 'This posts the retained-earnings roll and hard-closes every period in the year. It cannot be undone.',
          confirmLabel: 'Close year',
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.run(this.gl.closeFiscalYear(fiscalYearId));
      });
  }

  private run(action: Observable<unknown>): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageOf(e));
      },
    });
  }

  private messageOf(e: unknown): string {
    const err = e as { error?: { message?: string; detail?: string } };
    return err?.error?.message ?? err?.error?.detail ?? 'The action could not be completed.';
  }
}
