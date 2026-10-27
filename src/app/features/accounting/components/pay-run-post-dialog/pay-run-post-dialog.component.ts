import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
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
import { PayRunService } from '../../services/pay-run.service';
import { PayRun } from '../../models/pay-run.model';
import { PayRunJournalLine } from '../../models/pay-run-journal-line.model';

export interface PayRunPostDialogData {
  payRun: PayRun;
}

/**
 * Phase-5 pay-run post confirmation: shows the journal the post will write (accounts resolved from the book's
 * determination rules) before the user confirms. An unmapped key blocks the post. Closes with the posted run.
 */
@Component({
  selector: 'app-pay-run-post-dialog',
  standalone: true,
  imports: [TranslatePipe, CurrencyPipe, DialogComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './pay-run-post-dialog.component.html',
  styleUrl: './pay-run-post-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PayRunPostDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<PayRunPostDialogComponent, PayRun | undefined>);
  private readonly payRuns = inject(PayRunService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<PayRunPostDialogData>(MAT_DIALOG_DATA);

  protected readonly columns: ColumnDef[] = [
    { field: 'account', header: this.translate.instant('accounting.journalEditor.account') },
    { field: 'description', header: this.translate.instant('accounting.common.description') },
    { field: 'debit', header: this.translate.instant('accounting.common.debit'), align: 'right', width: '120px' },
    { field: 'credit', header: this.translate.instant('accounting.common.credit'), align: 'right', width: '120px' },
  ];

  protected readonly loading = signal(true);
  protected readonly posting = signal(false);
  protected readonly lines = signal<PayRunJournalLine[]>([]);
  protected readonly unmapped = computed(() => this.lines().filter((l) => l.glAccountId === null).map((l) => l.accountKey));
  protected readonly unmappedText = computed(() => this.unmapped().join(', '));
  protected readonly totalDebit = computed(() => this.lines().reduce((sum, l) => sum + l.debit, 0));
  protected readonly totalCredit = computed(() => this.lines().reduce((sum, l) => sum + l.credit, 0));
  protected readonly canPost = computed(() => !this.loading() && !this.posting() && this.lines().length > 0 && this.unmapped().length === 0);

  ngOnInit(): void {
    this.payRuns.journalPreview(this.data.payRun.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (lines) => {
          this.lines.set(lines);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.payRuns.previewFailed');
        },
      });
  }

  protected post(): void {
    if (!this.canPost()) return;
    this.posting.set(true);
    this.payRuns.post(this.data.payRun.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.posting.set(false);
          this.dialogRef.close(run);
        },
        error: () => this.posting.set(false),
      });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
