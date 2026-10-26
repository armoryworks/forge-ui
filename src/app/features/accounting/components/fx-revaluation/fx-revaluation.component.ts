import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { concatMap, from, toArray } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { FxRevaluationResult } from '../../models/fx-revaluation-result.model';
import { FxRevaluationRun } from '../../models/fx-revaluation-run.model';
import { GeneralLedgerService } from '../../services/general-ledger.service';

const DEFAULT_BOOK_ID = 1;

/** A previewed currency with the rate the run will use, editable before posting. */
interface RevaluationRow {
  result: FxRevaluationResult;
  rate: FormControl<number | null>;
}

/**
 * Period-close step that re-measures open foreign-currency receivables, payables and cash at the
 * period-end rates. Preview first (rates pre-filled from Admin > Currencies, editable per currency),
 * then run; each entry posts to FX revaluation / unrealized gain or loss and reverses in the next
 * period. Controller only, CAP-ACCT-FXREVAL.
 */
@Component({
  selector: 'app-fx-revaluation',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe,
    DataTableComponent, ColumnCellDirective, CurrencyDisplayComponent, DatepickerComponent, InputComponent,
  ],
  templateUrl: './fx-revaluation.component.html',
  styleUrl: './fx-revaluation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FxRevaluationComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly asOfControl = new FormControl<Date | null>(lastDayOfPreviousMonth(), [Validators.required]);
  protected readonly busy = signal(false);
  protected readonly previewed = signal(false);
  protected readonly rows = signal<RevaluationRow[]>([]);
  protected readonly runs = signal<FxRevaluationRun[]>([]);
  private readonly rateTick = signal(0);

  protected readonly previewRows = computed(() => {
    this.rateTick();
    return this.rows().map(row => {
      const rate = row.rate.value ?? row.result.rate;
      const adjustment = Math.round((row.result.netForeignPosition * rate - row.result.carryingFunctional) * 100) / 100;
      return {
        currencyId: row.result.currencyId,
        currencyCode: row.result.currencyCode,
        netForeignPosition: row.result.netForeignPosition,
        carryingFunctional: row.result.carryingFunctional,
        adjustment,
        rateControl: row.rate,
      };
    });
  });
  protected readonly totalAdjustment = computed(() =>
    Math.round(this.previewRows().reduce((sum, r) => sum + r.adjustment, 0) * 100) / 100);

  protected readonly previewColumns: ColumnDef[] = [
    { field: 'currencyCode', header: this.translate.instant('accounting.currency.currency'), width: '100px' },
    { field: 'netForeignPosition', header: this.translate.instant('accounting.fxRevaluation.openPosition'), type: 'number', align: 'right', width: '160px' },
    { field: 'carryingFunctional', header: this.translate.instant('accounting.fxRevaluation.carryingValue'), type: 'number', align: 'right', width: '150px' },
    { field: 'rate', header: this.translate.instant('accounting.fxRevaluation.periodEndRate'), width: '170px' },
    { field: 'adjustment', header: this.translate.instant('accounting.fxRevaluation.adjustment'), type: 'number', align: 'right', width: '140px' },
  ];

  protected readonly runColumns: ColumnDef[] = [
    { field: 'entryNumber', header: this.translate.instant('accounting.fxRevaluation.entry'), type: 'number', width: '100px' },
    { field: 'asOf', header: this.translate.instant('accounting.period.asOf'), type: 'date', width: '120px' },
    { field: 'currencyCode', header: this.translate.instant('accounting.currency.currency'), width: '100px' },
    { field: 'adjustment', header: this.translate.instant('accounting.fxRevaluation.adjustment'), type: 'number', align: 'right', width: '140px' },
    { field: 'reversed', header: this.translate.instant('accounting.fxRevaluation.reversed'), width: '120px' },
  ];

  ngOnInit(): void {
    this.loadRuns();
  }

  protected preview(): void {
    const asOf = toDateOnly(this.asOfControl.value);
    if (!asOf) return;
    this.busy.set(true);
    this.gl.revalueAllFx(DEFAULT_BOOK_ID, asOf, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: results => {
        this.rows.set(results.map(result => {
          const rate = new FormControl<number | null>(result.rate, [Validators.required, Validators.min(0.00000001)]);
          rate.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.rateTick.update(n => n + 1));
          return { result, rate };
        }));
        this.previewed.set(true);
        this.busy.set(false);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'accounting.fxRevaluation.previewFailed');
      },
    });
  }

  protected confirmRun(): void {
    if (this.rows().length === 0 || this.rows().some(r => r.rate.invalid)) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.translate.instant('accounting.fxRevaluation.confirmTitle'),
          message: this.translate.instant('accounting.fxRevaluation.confirmMessage'),
          confirmLabel: this.translate.instant('accounting.fxRevaluation.run'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) this.run();
      });
  }

  private run(): void {
    const asOf = toDateOnly(this.asOfControl.value);
    if (!asOf) return;
    this.busy.set(true);
    from(this.rows())
      .pipe(
        concatMap(row => this.gl.revalueFx(DEFAULT_BOOK_ID, row.result.currencyId, row.rate.value, asOf)),
        toArray(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: results => {
          this.busy.set(false);
          this.rows.set([]);
          this.previewed.set(false);
          const posted = results.filter(r => r.journalEntryId !== null).length;
          this.snackbar.success(this.translate.instant('accounting.fxRevaluation.posted', { count: posted }));
          this.loadRuns();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.snackbar.errorFrom(err, 'accounting.fxRevaluation.runFailed');
          this.loadRuns();
        },
      });
  }

  private loadRuns(): void {
    this.gl.getFxRevaluations(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: runs => this.runs.set(runs),
      error: () => this.runs.set([]),
    });
  }
}

function lastDayOfPreviousMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}
