import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { filter, forkJoin, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { RowExpandDirective } from '../../../../shared/directives/row-expand.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { JournalEntryExplanation, LedgerRegisterEntry, LedgerRegisterPage, ReverseJournalEntryInput, TrialBalanceRow } from '../../models/accounting.models';
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
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, PageHeaderComponent, InputComponent, DataTableComponent, CurrencyDisplayComponent, RowExpandDirective, ColumnCellDirective],
  templateUrl: './ledger-view.component.html',
  styleUrl: './ledger-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerViewComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<LedgerRegisterPage | null>(null);
  /** Account lens (§5A.1 `:accountId`): when set, the register is scoped to one account. */
  private readonly accountId = signal<number | null>(null);
  protected readonly lensAccount = signal<TrialBalanceRow | null>(null);
  /**
   * Register rows with a display-ready date. entryDate is a DateOnly ("YYYY-MM-DD") — reformatted
   * purely as a string (MM/dd/yyyy) because `new Date("YYYY-MM-DD")` parses as UTC midnight and
   * renders as the PREVIOUS day in any western timezone (caught by visual verification 2026-07-07).
   */
  protected readonly entries = computed<(LedgerRegisterEntry & { entryDateDisplay: string; balanceAfter?: number })[]>(() => {
    const lens = this.lensAccount();
    // Running balance (lens only), walked newest -> oldest in the SAME debit-positive (Dr - Cr)
    // convention the trial balance reports: the newest row carries the account's current
    // netBalance; each older row subtracts the newer entry's net effect on this account.
    let balance = lens?.netBalance ?? 0;
    return (this.page()?.data ?? []).map((e, i, rows) => {
      const [y, m, d] = e.entryDate.split('-');
      const row: LedgerRegisterEntry & { entryDateDisplay: string; balanceAfter?: number } = {
        ...e,
        entryDateDisplay: `${m}/${d}/${y}`,
      };
      if (lens) {
        if (i > 0) balance -= this.accountNet(rows[i - 1], lens.glAccountId);
        row.balanceAfter = balance;
      }
      return row;
    });
  });

  /** This entry's net (Dr - Cr) effect on one account. */
  private accountNet(entry: LedgerRegisterEntry, glAccountId: number): number {
    return entry.lines
      .filter((l) => l.glAccountId === glAccountId)
      .reduce((acc, l) => acc + l.debit - l.credit, 0);
  }
  protected readonly explanations = signal<Record<number, ExplainState>>({});
  protected readonly scanning = signal(false);
  protected readonly anomalyFlags = signal<Record<number, string[]>>({});
  protected readonly anomalyCount = computed(() => Object.keys(this.anomalyFlags()).length);

  // ── Find-in-context (§5A.1): matches are highlighted and navigated to, never filtered out. ──
  private readonly table = viewChild(DataTableComponent);
  protected readonly findControl = new FormControl<string>('', { nonNullable: true });
  private readonly findTerm = toSignal(this.findControl.valueChanges, { initialValue: '' });
  protected readonly matches = computed(() => {
    const term = this.findTerm().trim().toLowerCase();
    if (!term) return [];
    return this.entries().filter((e) => this.entryMatches(e, term));
  });
  protected readonly currentMatchIndex = signal(0);
  private located = false;
  /**
   * Fresh closure per find state so the OnPush data-table re-evaluates row classes when the
   * match set or cursor moves (a stable fn reference would never re-render the child).
   */
  protected readonly rowClassFn = computed<(row: unknown) => string>(() => {
    const matchIds = new Set(this.matches().map((m) => m.id));
    const current = this.matches()[this.currentMatchIndex()]?.id;
    return (row: unknown) => {
      const id = (row as LedgerRegisterEntry).id;
      if (id === current) return 'row--find-match row--find-current';
      return matchIds.has(id) ? 'row--find-match' : '';
    };
  });

  private entryMatches(entry: LedgerRegisterEntry & { entryDateDisplay: string }, term: string): boolean {
    if (
      String(entry.entryNumber).includes(term) ||
      entry.entryDateDisplay.includes(term) ||
      entry.source.toLowerCase().includes(term) ||
      entry.status.toLowerCase().includes(term) ||
      (entry.memo ?? '').toLowerCase().includes(term)
    ) {
      return true;
    }
    return entry.lines.some(
      (l) =>
        l.accountNumber.includes(term) ||
        l.accountName.toLowerCase().includes(term) ||
        (l.description ?? '').toLowerCase().includes(term) ||
        (l.debit > 0 && String(l.debit).includes(term)) ||
        (l.credit > 0 && String(l.credit).includes(term)),
    );
  }

  protected findNext(step: 1 | -1 = 1): void {
    const total = this.matches().length;
    if (total === 0) return;
    this.currentMatchIndex.update((i) => (i + step + total) % total);
    const match = this.matches()[this.currentMatchIndex()];
    if (match) this.table()?.scrollToRow(match);
  }

  /** Browser-find semantics: the first Enter after a term change locates match 1; repeats cycle. */
  protected onFindEnter(): void {
    if (this.matches().length === 0) return;
    if (!this.located) {
      this.located = true;
      const match = this.matches()[this.currentMatchIndex()];
      if (match) this.table()?.scrollToRow(match);
      return;
    }
    this.findNext(1);
  }

  protected readonly columns = computed<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [
      { field: 'entryNumber', header: this.translate.instant('accounting.ledger.entryNumber'), sortable: true, width: '90px' },
      // NOT type:'date' — the shared date formatter is for timestamps (adds a time + TZ-shifts DateOnly).
      { field: 'entryDate', header: this.translate.instant('accounting.common.date'), sortable: true, width: '110px' },
      { field: 'source', header: this.translate.instant('accounting.ledger.source'), sortable: true, filterable: true, type: 'enum', width: '120px' },
      { field: 'status', header: this.translate.instant('accounting.common.status'), sortable: true, filterable: true, type: 'enum', width: '140px' },
      { field: 'memo', header: this.translate.instant('accounting.ledger.memo'), sortable: true },
    ];
    if (this.lensAccount()) {
      cols.push({ field: 'balanceAfter', header: this.translate.instant('accounting.ledger.balance'), align: 'right', width: '150px' });
    }
    return cols;
  });

  constructor() {
    autoRefreshOnGlChange(() => this.load());
    // A term change restarts the find cursor.
    this.findControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.currentMatchIndex.set(0);
      this.located = false;
    });
  }

  ngOnInit(): void {
    // URL is the source of truth for the lens: /accounting/ledger/:accountId scopes to one account.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('accountId'));
      this.accountId.set(id > 0 ? id : null);
      this.load();
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    const accountId = this.accountId();
    const register$ = this.gl.getLedgerRegister(DEFAULT_BOOK_ID, {
      pageSize: PAGE_SIZE,
      glAccountId: accountId,
    });

    if (accountId === null) {
      this.lensAccount.set(null);
      register$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
      return;
    }

    // Lens: the trial balance supplies the account's label + current net balance, which seeds the
    // running-balance walk. Loaded together so the balance column never renders from stale data.
    forkJoin([register$, this.gl.getTrialBalance(DEFAULT_BOOK_ID)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([p, tb]) => {
          this.lensAccount.set(tb.rows.find((r) => r.glAccountId === accountId) ?? null);
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
