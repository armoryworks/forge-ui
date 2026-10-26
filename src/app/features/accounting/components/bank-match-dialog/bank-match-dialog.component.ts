import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BankStatementService } from '../../services/bank-statement.service';
import { BankMatchCandidate } from '../../models/bank-match-candidate.model';
import { BankStatementLineModel } from '../../models/accounting.models';

export interface BankMatchDialogData {
  line: BankStatementLineModel;
}

const WIDE_WINDOW_DAYS = 120;

/**
 * BANK-001 manual match: lists the Posted cash journal lines a statement line can be matched to (best fit
 * first — amount difference, then days apart), lets the user pick one and confirms the match. One statement
 * line matches one journal line. Closes with the updated line, or `undefined` when cancelled.
 */
@Component({
  selector: 'app-bank-match-dialog',
  standalone: true,
  imports: [TranslatePipe, CurrencyPipe, DialogComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './bank-match-dialog.component.html',
  styleUrl: './bank-match-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankMatchDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<BankMatchDialogComponent, BankStatementLineModel | undefined>);
  private readonly statements = inject(BankStatementService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<BankMatchDialogData>(MAT_DIALOG_DATA);

  protected readonly loading = signal(false);
  protected readonly matching = signal(false);
  protected readonly widened = signal(false);
  protected readonly candidates = signal<BankMatchCandidate[]>([]);
  protected readonly selected = signal<BankMatchCandidate | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'entryDate', header: this.translate.instant('common.date'), width: '100px' },
    { field: 'entryNumber', header: this.translate.instant('accounting.bankMatch.entry'), width: '80px' },
    { field: 'amount', header: this.translate.instant('payables.amount'), width: '110px', align: 'right' },
    { field: 'memo', header: this.translate.instant('accounting.bankMatch.memo') },
    { field: 'source', header: this.translate.instant('accounting.bankMatch.source'), width: '110px' },
    { field: 'fit', header: this.translate.instant('accounting.bankMatch.fit'), width: '150px' },
  ];

  ngOnInit(): void {
    this.load(null);
  }

  protected widen(): void {
    this.widened.set(true);
    this.load(WIDE_WINDOW_DAYS);
  }

  protected select(candidate: BankMatchCandidate): void {
    this.selected.set(candidate);
  }

  protected rowClass = (row: unknown): string =>
    (row as BankMatchCandidate).journalLineId === this.selected()?.journalLineId ? 'row--selected' : '';

  protected confirm(): void {
    const candidate = this.selected();
    if (!candidate || this.matching()) return;
    this.matching.set(true);
    this.statements.match(this.data.line.id, candidate.journalLineId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (line) => {
          this.matching.set(false);
          this.snackbar.success(this.translate.instant('accounting.bankMatch.matched', { number: candidate.entryNumber }));
          this.dialogRef.close(line);
        },
        error: () => this.matching.set(false),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  private load(days: number | null): void {
    this.loading.set(true);
    this.selected.set(null);
    this.statements.getCandidates(this.data.line.id, days)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.candidates.set(list);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.bankMatch.loadFailed');
        },
      });
  }
}
