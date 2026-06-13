import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { ArAging } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

/** Flattened aging row — bucket amounts hoisted to top-level b{i} fields so the shared table can render/sort them. */
interface AgingTableRow {
  partyName: string;
  openBalance: number;
  [bucketKey: string]: string | number;
}

@Component({
  selector: 'app-ar-aging',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, CurrencyDisplayComponent, DataTableComponent, ColumnCellDirective],
  templateUrl: './ar-aging.component.html',
  styleUrl: './ar-aging.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArAgingComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<ArAging | null>(null);

  /** Dynamic columns: Customer + one per aging bucket + Open, derived from the report's bucket set. */
  protected readonly columns = computed<ColumnDef[]>(() => {
    const r = this.report();
    if (!r) return [];
    const buckets: ColumnDef[] = r.totalsByBucket.map((b, i) => ({
      field: `b${i}`, header: b.label, sortable: true, type: 'number', align: 'right', width: '120px',
    }));
    return [
      { field: 'partyName', header: this.translate.instant('accounting.arAging.customer'), sortable: true },
      ...buckets,
      { field: 'openBalance', header: this.translate.instant('accounting.common.open'), sortable: true, type: 'number', align: 'right', width: '130px' },
    ];
  });

  protected readonly rows = computed<AgingTableRow[]>(() => {
    const r = this.report();
    if (!r) return [];
    return r.customers.map((c) => {
      const row: AgingTableRow = { partyName: c.customerName ?? '—', openBalance: c.openBalance };
      c.buckets.forEach((b, i) => (row[`b${i}`] = b.amount));
      return row;
    });
  });

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
      .getArAging(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.report.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.arAgingLoadFailed'));
          this.loading.set(false);
        },
      });
  }
}
