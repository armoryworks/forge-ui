import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { forkJoin, map, of } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { BudgetLine, BudgetVsActual, GlAccount } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

type BudgetMode = 'entry' | 'vs-actual';

interface BudgetRow {
  account: GlAccount;
  controlName: string;
}

/**
 * Budget entry + budget-vs-actual P&L comparison (CAP-ACCT-FULLGL). Enter full-year
 * budget amounts per Income/Expense account for a fiscal year, or compare budget vs
 * actual (actuals from the same ledger projection the P&L uses). Year/period/mode are
 * URL-driven so the view is shareable and back-button friendly.
 */
@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    CurrencyInputComponent,
    CurrencyDisplayComponent,
    SelectComponent,
  ],
  templateUrl: './budgets.component.html',
  styleUrl: './budgets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsComponent {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly rows = signal<BudgetRow[]>([]);
  protected readonly comparison = signal<BudgetVsActual | null>(null);
  protected readonly form = signal<FormGroup>(new FormGroup({}));

  /** Existing budget id per account (full-year row), so save knows update vs create vs delete. */
  private budgetIdByAccount = new Map<number, number>();
  private initialAmountByAccount = new Map<number, number | null>();

  protected readonly mode = toSignal(
    this.route.queryParamMap.pipe(map((p) => ((p.get('mode') as BudgetMode) ?? 'entry'))),
    { initialValue: 'entry' as BudgetMode },
  );

  protected readonly fiscalYear = toSignal(
    this.route.queryParamMap.pipe(
      map((p) => Number(p.get('year')) || new Date().getFullYear()),
    ),
    { initialValue: new Date().getFullYear() },
  );

  protected readonly periodMonth = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('month') ? Number(p.get('month')) : null))),
    { initialValue: null as number | null },
  );

  protected readonly monthControl = new FormControl<number | null>(null);

  protected readonly monthOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.budget.fullYear') },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: this.translate.instant(`accounting.budget.months.${i + 1}`),
    })),
  ]);

  constructor() {
    autoRefreshOnGlChange(() => this.load());

    effect(() => {
      const on = this.periodMonth();
      if (this.monthControl.value !== on) this.monthControl.setValue(on, { emitEvent: false });
    });

    this.monthControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((month) => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { month: month ?? null },
        queryParamsHandling: 'merge',
      });
    });

    // URL (mode / year / month) drives the load.
    effect(() => {
      this.mode();
      this.fiscalYear();
      this.periodMonth();
      this.load();
    });
  }

  protected setMode(mode: BudgetMode): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mode: mode === 'entry' ? null : mode },
      queryParamsHandling: 'merge',
    });
  }

  protected stepYear(delta: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { year: this.fiscalYear() + delta },
      queryParamsHandling: 'merge',
    });
  }

  protected load(): void {
    if (this.mode() === 'vs-actual') {
      this.loadComparison();
    } else {
      this.loadEntry();
    }
  }

  private loadEntry(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      accounts: this.gl.getChartOfAccounts(DEFAULT_BOOK_ID, true),
      budgets: this.gl.listBudgets(DEFAULT_BOOK_ID, this.fiscalYear()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ accounts, budgets }) => {
          this.buildEntryForm(accounts, budgets);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.budget.loadFailed'));
          this.loading.set(false);
        },
      });
  }

  private buildEntryForm(accounts: GlAccount[], budgets: BudgetLine[]): void {
    const pnlAccounts = accounts.filter((a) => a.accountType === 'Income' || a.accountType === 'Expense');
    const fullYear = new Map(budgets.filter((b) => b.periodMonth == null).map((b) => [b.glAccountId, b]));

    this.budgetIdByAccount = new Map();
    this.initialAmountByAccount = new Map();

    const group: Record<string, FormControl<number | null>> = {};
    const rows: BudgetRow[] = [];
    for (const account of pnlAccounts) {
      const existing = fullYear.get(account.id);
      const amount = existing ? existing.amount : null;
      group[String(account.id)] = new FormControl<number | null>(amount);
      if (existing) this.budgetIdByAccount.set(account.id, existing.id);
      this.initialAmountByAccount.set(account.id, amount);
      rows.push({ account, controlName: String(account.id) });
    }

    this.form.set(new FormGroup(group));
    this.rows.set(rows);
  }

  protected save(): void {
    const form = this.form();
    const year = this.fiscalYear();

    const upserts = this.rows()
      .filter((row) => {
        const value = form.get(row.controlName)?.value as number | null;
        return value != null && value !== this.initialAmountByAccount.get(row.account.id);
      })
      .map((row) =>
        this.gl.upsertBudget({
          bookId: DEFAULT_BOOK_ID,
          glAccountId: row.account.id,
          fiscalYear: year,
          periodMonth: null,
          amount: form.get(row.controlName)?.value as number,
        }),
      );

    // A cleared amount for an account that had a budget → delete that line.
    const deletes = this.rows()
      .filter((row) => {
        const value = form.get(row.controlName)?.value as number | null;
        return value == null && this.budgetIdByAccount.has(row.account.id);
      })
      .map((row) => this.gl.deleteBudget(this.budgetIdByAccount.get(row.account.id)!));

    if (upserts.length === 0 && deletes.length === 0) return;

    this.saving.set(true);
    this.error.set(null);
    forkJoin([...(upserts.length ? upserts : [of(null)]), ...(deletes.length ? deletes : [of(null)])])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.loadEntry();
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.budget.saveFailed'));
          this.saving.set(false);
        },
      });
  }

  private loadComparison(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl
      .getBudgetVsActual(DEFAULT_BOOK_ID, this.fiscalYear(), this.periodMonth())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.comparison.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.translate.instant('accounting.budget.loadFailed'));
          this.loading.set(false);
        },
      });
  }
}
