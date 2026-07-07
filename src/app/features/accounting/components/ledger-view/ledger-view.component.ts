import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { filter, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { RowExpandDirective } from '../../../../shared/directives/row-expand.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { JournalEntryExplanation, LedgerRegisterEntry, LedgerRegisterPage, ReverseJournalEntryInput } from '../../models/accounting.models';
import { ReverseEntryDialogComponent, ReverseEntryDialogData } from '../reverse-entry-dialog/reverse-entry-dialog.component';

/** Default book — single-book Phase 2/3; a book selector arrives with multi-book support. */
const DEFAULT_BOOK_ID = 1;
/**
 * First page is generous; per-book server-page navigation and the virtualized find-in-context
 * scroller (ACCOUNTING_SUITE_PLAN §5A.1) are the follow-on. This interim register renders the most
 * recent {@link PAGE_SIZE} entries and leans on the shared data-table for sort/filter/paginate.
 */
const PAGE_SIZE = 100;

interface ExplainState {
  loading: boolean;
  result: JournalEntryExplanation | null;
  failed: boolean;
}

/**
 * §5A ledger view: the append-only journal register for a book — each entry expands to its balanced
 * lines and drill-back refs, with a read-only "Explain with AI" advisory per entry. Read/operate only;
 * corrections are posted as new reversing entries elsewhere (never edited here).
 */
@Component({
  selector: 'app-ledger-view',
  standalone: true,
  imports: [TranslatePipe, PageHeaderComponent, DataTableComponent, CurrencyDisplayComponent, RowExpandDirective, ColumnCellDirective],
  templateUrl: './ledger-view.component.html',
  styleUrl: './ledger-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerViewComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<LedgerRegisterPage | null>(null);
  /**
   * Register rows with a display-ready date. entryDate is a DateOnly ("YYYY-MM-DD") — reformatted
   * purely as a string (MM/dd/yyyy) because `new Date("YYYY-MM-DD")` parses as UTC midnight and
   * renders as the PREVIOUS day in any western timezone (caught by visual verification 2026-07-07).
   */
  protected readonly entries = computed<(LedgerRegisterEntry & { entryDateDisplay: string })[]>(() =>
    (this.page()?.data ?? []).map((e) => {
      const [y, m, d] = e.entryDate.split('-');
      return { ...e, entryDateDisplay: `${m}/${d}/${y}` };
    }),
  );
  protected readonly explanations = signal<Record<number, ExplainState>>({});
  protected readonly scanning = signal(false);
  protected readonly anomalyFlags = signal<Record<number, string[]>>({});
  protected readonly anomalyCount = computed(() => Object.keys(this.anomalyFlags()).length);

  protected readonly columns: ColumnDef[] = [
    { field: 'entryNumber', header: this.translate.instant('accounting.ledger.entryNumber'), sortable: true, width: '90px' },
    // NOT type:'date' — the shared date formatter is for timestamps (adds a time + TZ-shifts DateOnly).
    { field: 'entryDate', header: this.translate.instant('accounting.common.date'), sortable: true, width: '110px' },
    { field: 'source', header: this.translate.instant('accounting.ledger.source'), sortable: true, filterable: true, type: 'enum', width: '120px' },
    { field: 'status', header: this.translate.instant('accounting.common.status'), sortable: true, filterable: true, type: 'enum', width: '140px' },
    { field: 'memo', header: this.translate.instant('accounting.ledger.memo'), sortable: true },
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
      .getLedgerRegister(DEFAULT_BOOK_ID, { pageSize: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.page.set(p);
          this.explanations.set({});
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.errors.ledgerLoadFailed'));
          this.loading.set(false);
        },
      });
  }

  protected explain(entry: LedgerRegisterEntry): void {
    this.explanations.update((s) => ({ ...s, [entry.id]: { loading: true, result: null, failed: false } }));
    this.gl
      .explainJournalEntry(DEFAULT_BOOK_ID, entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) =>
          this.explanations.update((s) => ({ ...s, [entry.id]: { loading: false, result, failed: false } })),
        error: () =>
          this.explanations.update((s) => ({ ...s, [entry.id]: { loading: false, result: null, failed: true } })),
      });
  }

  protected scanAnomalies(): void {
    this.scanning.set(true);
    this.gl
      .getGlAnomalies(DEFAULT_BOOK_ID)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (anomalies) => {
          const flags: Record<number, string[]> = {};
          for (const anomaly of anomalies) flags[anomaly.entryId] = anomaly.flags;
          this.anomalyFlags.set(flags);
          this.scanning.set(false);
        },
        error: () => {
          this.snackbar.error(this.translate.instant('accounting.errors.anomalyScanFailed'));
          this.scanning.set(false);
        },
      });
  }

  protected reverseEntry(entry: LedgerRegisterEntry): void {
    this.dialog
      .open<ReverseEntryDialogComponent, ReverseEntryDialogData, ReverseJournalEntryInput | undefined>(
        ReverseEntryDialogComponent,
        { width: '480px', data: { entryNumber: entry.entryNumber } },
      )
      .afterClosed()
      .pipe(
        filter((result): result is ReverseJournalEntryInput => !!result),
        switchMap((result) => this.gl.reverseJournalEntry(entry.id, result)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (reversal) => {
          this.snackbar.success(this.translate.instant('accounting.reverse.done', { number: reversal.entryNumber }));
          this.load();
        },
      });
  }
}
