import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import {
  BankReconciliationSummary,
  BankReconciliationWorksheet,
  CashAccountModel,
} from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-bank-rec',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent, CurrencyDisplayComponent],
  templateUrl: './bank-rec.component.html',
  styleUrl: './bank-rec.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankRecComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly cashAccounts = signal<CashAccountModel[]>([]);
  protected readonly reconciliations = signal<BankReconciliationSummary[]>([]);
  protected readonly worksheet = signal<BankReconciliationWorksheet | null>(null);

  // Start-new form state.
  protected cashAccountId = 0;
  protected statementDate = '';
  protected endingBalance = 0;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl.getCashAccounts(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.cashAccounts.set(a);
        if (a.length && this.cashAccountId === 0) this.cashAccountId = a[0].glAccountId;
      },
      error: () => this.error.set('Could not load cash accounts.'),
    });
    this.gl.getBankReconciliations(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.reconciliations.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load reconciliations.');
        this.loading.set(false);
      },
    });
  }

  protected start(): void {
    if (!this.cashAccountId || !this.statementDate) {
      this.error.set('Pick a cash account and statement date.');
      return;
    }
    this.run(this.gl.startBankReconciliation(DEFAULT_BOOK_ID, this.cashAccountId, this.statementDate, this.endingBalance));
  }

  protected open(reconciliationId: number): void {
    this.run(this.gl.getBankReconciliation(reconciliationId));
  }

  protected toggle(journalLineId: number, cleared: boolean): void {
    const ws = this.worksheet();
    if (!ws || ws.status !== 'Draft') return;
    this.run(this.gl.setBankReconciliationItemCleared(ws.reconciliationId, journalLineId, cleared));
  }

  protected finalize(): void {
    const ws = this.worksheet();
    if (!ws) return;
    this.run(this.gl.finalizeBankReconciliation(ws.reconciliationId), { refreshList: true });
  }

  protected closeWorksheet(): void {
    this.worksheet.set(null);
  }

  private run(action: Observable<BankReconciliationWorksheet>, opts?: { refreshList?: boolean }): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ws) => {
        this.worksheet.set(ws);
        this.busy.set(false);
        if (opts?.refreshList) this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const err = e as { error?: { message?: string; detail?: string } };
        this.error.set(err?.error?.message ?? err?.error?.detail ?? 'The action could not be completed.');
      },
    });
  }
}
