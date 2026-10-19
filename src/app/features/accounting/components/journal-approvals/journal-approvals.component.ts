import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import { forkJoin } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { ManualJournalEntryResult } from '../../models/accounting.models';
import { RejectEntryDialogComponent, RejectEntryDialogData } from '../reject-entry-dialog/reject-entry-dialog.component';

const DEFAULT_BOOK_ID = 1;

interface PendingEntryView {
  entry: ManualJournalEntryResult;
  dateLabel: string;
  total: number;
  ownEntry: boolean;
  lines: { id: number; account: string; debit: number; credit: number; description: string | null }[];
}

/**
 * Maker-checker work-list (§5.7): manual journal entries over the approval threshold wait here as
 * PendingApproval until a second Controller approves them into the ledger or rejects them back to
 * Draft. The server refuses an approval by the entry's own submitter.
 */
@Component({
  selector: 'app-journal-approvals',
  standalone: true,
  imports: [
    TranslatePipe, PageLayoutComponent, CurrencyDisplayComponent, EmptyStateComponent, LoadingBlockDirective,
    DataTableComponent, ColumnCellDirective,
  ],
  templateUrl: './journal-approvals.component.html',
  styleUrl: './journal-approvals.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalApprovalsComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private bookId = DEFAULT_BOOK_ID;
  private readonly accountLabels = signal<Map<number, string>>(new Map());
  private readonly pending = signal<ManualJournalEntryResult[]>([]);
  protected readonly loading = signal(true);
  protected readonly lineColumns: ColumnDef[] = [
    { field: 'account', header: this.translate.instant('accounting.journalEditor.account') },
    { field: 'debit', header: this.translate.instant('accounting.common.debit'), type: 'number', align: 'right', width: '150px' },
    { field: 'credit', header: this.translate.instant('accounting.common.credit'), type: 'number', align: 'right', width: '150px' },
    { field: 'description', header: this.translate.instant('accounting.common.description') },
  ];
  protected readonly busyId = signal<number | null>(null);

  protected readonly entries = computed<PendingEntryView[]>(() => {
    const labels = this.accountLabels();
    const me = this.auth.user()?.id ?? null;
    return this.pending().map((entry) => {
      const lines = (entry.lines ?? []).map((line) => ({
        id: line.id,
        account: labels.get(line.glAccountId) ?? `#${line.glAccountId}`,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      }));
      const [year, month, day] = entry.entryDate.slice(0, 10).split('-');
      return {
        entry,
        dateLabel: `${month}/${day}/${year}`,
        total: lines.reduce((sum, l) => sum + l.debit, 0),
        ownEntry: me !== null && entry.postedBy === me,
        lines,
      };
    });
  });

  ngOnInit(): void {
    const book = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.bookId = book > 0 ? book : DEFAULT_BOOK_ID;
    forkJoin([this.gl.getChartOfAccounts(this.bookId), this.gl.getPendingJournalEntries(this.bookId)])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([accounts, pending]) => {
          this.accountLabels.set(new Map(accounts.map((a) => [a.id, `${a.accountNumber} — ${a.name}`])));
          this.pending.set(pending);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.approvals.loadFailed');
        },
      });
  }

  protected approve(entry: ManualJournalEntryResult): void {
    if (this.busyId() !== null) return;
    this.busyId.set(entry.id);
    this.gl.approveJournalEntry(entry.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('accounting.approvals.approved', { number: entry.entryNumber }));
        this.settle(entry.id);
      },
      error: () => this.busyId.set(null),
    });
  }

  protected reject(entry: ManualJournalEntryResult): void {
    if (this.busyId() !== null) return;
    this.dialog
      .open<RejectEntryDialogComponent, RejectEntryDialogData, string | undefined>(RejectEntryDialogComponent, {
        width: '480px',
        data: { entryNumber: entry.entryNumber },
      })
      .afterClosed()
      .subscribe((reason) => {
        if (reason === undefined) return;
        this.busyId.set(entry.id);
        this.gl.rejectJournalEntry(entry.id, reason || null).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('accounting.approvals.rejected', { number: entry.entryNumber }));
            this.settle(entry.id);
          },
          error: () => this.busyId.set(null),
        });
      });
  }

  private settle(entryId: number): void {
    this.busyId.set(null);
    this.pending.update((list) => list.filter((e) => e.id !== entryId));
  }
}
