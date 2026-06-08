import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { TrialBalance } from '../../models/accounting.models';

/** Default book — single-book Phase 2/3; a book selector arrives with multi-book support. */
const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-trial-balance',
  standalone: true,
  imports: [PageHeaderComponent, CurrencyDisplayComponent, DataTableComponent, ColumnCellDirective],
  templateUrl: './trial-balance.component.html',
  styleUrl: './trial-balance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrialBalanceComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<TrialBalance | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'accountNumber', header: 'Account #', sortable: true, width: '130px' },
    { field: 'accountName', header: 'Account', sortable: true },
    { field: 'debitTotal', header: 'Debit', sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'creditTotal', header: 'Credit', sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'netBalance', header: 'Net', sortable: true, type: 'number', align: 'right', width: '150px' },
  ];

  constructor() {
    autoRefreshOnGlChange(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getTrialBalance(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load the trial balance.');
          this.loading.set(false);
        },
      });
  }
}
