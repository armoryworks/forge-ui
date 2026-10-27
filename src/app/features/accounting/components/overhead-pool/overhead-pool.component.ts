import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

import { forkJoin } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { parseDateOnly, toDateOnly } from '../../../../shared/utils/date.utils';
import { GlAccount } from '../../models/accounting.models';
import { OverheadPoolCloseResult } from '../../models/overhead-pool-close.model';
import { OverheadPoolStatus } from '../../models/overhead-pool-status.model';
import { VarianceReport } from '../../models/variance-report.model';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { OverheadPoolService } from '../../services/overhead-pool.service';
import { bookIdFromParams } from '../../utils/statement-period';

/**
 * Standard-costing overhead pool for a period end (`?asOf=` in the URL): actual overhead recorded into the pool
 * against overhead applied by jobs, the variance a close would post, recording actual overhead (accrued, or
 * reclassed from an expense or paid from cash), closing the period (posts the under- or over-absorption to the
 * spending variance and clears the pool, once per date), and the month's variance rollup. Controller,
 * CAP-ACCT-FULLGL.
 */
@Component({
  selector: 'app-overhead-pool',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateOnlyPipe, PageLayoutComponent, DatepickerComponent, CurrencyInputComponent,
    SelectComponent, InputComponent, CurrencyDisplayComponent, DataTableComponent, ColumnCellDirective,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './overhead-pool.component.html',
  styleUrl: './overhead-pool.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverheadPoolComponent implements OnInit {
  private readonly service = inject(OverheadPoolService);
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly status = signal<OverheadPoolStatus | null>(null);
  protected readonly variances = signal<VarianceReport | null>(null);
  protected readonly closeResult = signal<OverheadPoolCloseResult | null>(null);
  private readonly accounts = signal<GlAccount[]>([]);

  protected readonly asOfControl = new FormControl<Date | null>(lastDayOfPreviousMonth(), [Validators.required]);

  protected readonly recordForm = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    entryDate: new FormControl<Date | null>(lastDayOfPreviousMonth(), [Validators.required]),
    sourceGlAccountId: new FormControl<number | null>(null),
    memo: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly recordViolations = FormValidationService.getViolations(this.recordForm, {
    amount: this.translate.instant('accounting.common.amount'),
    entryDate: this.translate.instant('accounting.common.date'),
    memo: this.translate.instant('accounting.journalEditor.memo'),
  });

  protected readonly sourceOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.overhead.accruedDefault') },
    ...this.accounts()
      .filter((a) => ['Asset', 'Liability', 'Expense'].includes(a.accountType) && !a.isControlAccount)
      .map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })),
  ]);

  protected readonly canClose = computed(() => {
    const s = this.status();
    return !!s && s.isConfigured && !s.closedOnDate && (s.actualOverhead !== 0 || s.appliedOverhead !== 0) && !this.busy();
  });

  protected readonly varianceColumns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('accounting.overhead.varianceAccount') },
    { field: 'amount', header: this.translate.instant('accounting.common.amount'), type: 'number', align: 'right', width: '150px' },
    { field: 'direction', header: this.translate.instant('accounting.overhead.direction'), width: '150px' },
  ];

  protected readonly varianceRows = computed(() =>
    (this.variances()?.lines ?? []).map((l) => ({
      ...l,
      id: l.key,
      direction: l.amount === 0
        ? '—'
        : this.translate.instant(l.isFavorable ? 'accounting.overhead.favorable' : 'accounting.overhead.unfavorable'),
    })),
  );

  private bookId = 1;

  ngOnInit(): void {
    this.bookId = bookIdFromParams(this.route.snapshot.queryParamMap);
    const asOf = this.route.snapshot.queryParamMap.get('asOf');
    const parsed = asOf ? parseDateOnly(asOf) : null;
    if (parsed) {
      this.asOfControl.setValue(parsed, { emitEvent: false });
      this.recordForm.controls.entryDate.setValue(parsed);
    }

    this.asOfControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((date) => {
      const value = toDateOnly(date);
      if (!value) return;
      this.router.navigate([], { relativeTo: this.route, queryParams: { asOf: value }, queryParamsHandling: 'merge', replaceUrl: true });
      this.closeResult.set(null);
      this.load();
    });

    this.gl.getChartOfAccounts(this.bookId, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: () => this.accounts.set([]),
    });
    this.load();
  }

  protected load(): void {
    const asOf = toDateOnly(this.asOfControl.value);
    const date = this.asOfControl.value;
    if (!asOf || !date) return;
    const from = toDateOnly(new Date(date.getFullYear(), date.getMonth(), 1)) ?? asOf;
    this.loading.set(true);
    forkJoin({ status: this.service.status(asOf), variances: this.service.variances(from, asOf) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ status, variances }) => {
          this.status.set(status);
          this.variances.set(variances);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.overhead.loadFailed');
        },
      });
  }

  protected record(): void {
    if (this.recordForm.invalid || this.busy()) return;
    const raw = this.recordForm.getRawValue();
    this.busy.set(true);
    this.service
      .record({
        amount: raw.amount ?? 0,
        entryDate: toDateOnly(raw.entryDate) ?? '',
        sourceGlAccountId: raw.sourceGlAccountId,
        memo: raw.memo.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.recordForm.reset({ amount: null, entryDate: raw.entryDate, sourceGlAccountId: null, memo: '' });
          this.snackbar.success(this.translate.instant('accounting.overhead.recorded'));
          this.load();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.snackbar.errorFrom(err, 'accounting.overhead.recordFailed');
        },
      });
  }

  protected confirmClose(): void {
    const asOf = toDateOnly(this.asOfControl.value);
    const status = this.status();
    if (!asOf || !status || !this.canClose()) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '420px',
        data: {
          title: this.translate.instant('accounting.overhead.closeTitle'),
          message: this.translate.instant('accounting.overhead.closeMessage'),
          confirmLabel: this.translate.instant('accounting.overhead.close'),
          severity: 'warn',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) this.close(asOf);
      });
  }

  private close(asOf: string): void {
    this.busy.set(true);
    this.service.close(asOf).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.closeResult.set(result);
        this.snackbar.success(this.translate.instant(result.posted ? 'accounting.overhead.closed' : 'accounting.overhead.nothingToClose'));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.snackbar.errorFrom(err, 'accounting.overhead.closeFailed');
      },
    });
  }
}

function lastDayOfPreviousMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0);
}
