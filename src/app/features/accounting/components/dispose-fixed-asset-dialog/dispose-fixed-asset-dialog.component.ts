import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../../shared/utils/date.utils';
import { GlAccount } from '../../models/accounting.models';
import { FixedAssetDetail } from '../../models/fixed-asset-detail.model';
import { FixedAssetService } from '../../services/fixed-asset.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';

export interface DisposeFixedAssetDialogData {
  detail: FixedAssetDetail;
}

/**
 * Dispose of (sell or scrap) a fixed asset: date, proceeds and the cash or receivable account they went to, and
 * optionally the gain/loss account (else the book's default). Shows the book value at the disposal date
 * (including catch-up depreciation for months not yet run) and the resulting gain or loss before posting.
 * Closes with the disposal result.
 */
@Component({
  selector: 'app-dispose-fixed-asset-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DialogComponent, DatepickerComponent, CurrencyInputComponent, SelectComponent,
    InputComponent, CurrencyDisplayComponent, ValidationButtonComponent,
  ],
  templateUrl: './dispose-fixed-asset-dialog.component.html',
  styleUrl: './dispose-fixed-asset-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisposeFixedAssetDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<DisposeFixedAssetDialogComponent, unknown>);
  private readonly service = inject(FixedAssetService);
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly data = inject<DisposeFixedAssetDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  private readonly accounts = signal<GlAccount[]>([]);

  protected readonly form = new FormGroup({
    disposalDate: new FormControl<Date | null>(today(), [Validators.required]),
    proceeds: new FormControl<number | null>(0, [Validators.min(0)]),
    proceedsGlAccountId: new FormControl<number | null>(null),
    gainLossGlAccountId: new FormControl<number | null>(null),
    memo: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly proceedsAccountOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.fixedAssets.chooseAccount') },
    ...this.accounts()
      .filter((a) => a.accountType === 'Asset' && !a.isControlAccount)
      .map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })),
  ]);

  protected readonly gainLossAccountOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('accounting.fixedAssets.bookDefault') },
    ...this.accounts()
      .filter((a) => a.accountType === 'Income' || a.accountType === 'Expense')
      .map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })),
  ]);

  /** Book value at the disposal date: the schedule's accumulated depreciation for the months before it. */
  protected readonly bookValueAtDisposal = computed(() => {
    const date = this.value().disposalDate ?? null;
    const { asset, schedule } = this.data.detail;
    if (!date) return asset.netBookValue;
    const month = toDateOnly(new Date(date.getFullYear(), date.getMonth(), 1)) ?? '';
    const before = schedule.filter((row) => row.periodMonth < month);
    const posted = schedule.filter((row) => row.posted);
    const accumulated = Math.max(
      before.length ? before[before.length - 1].accumulatedDepreciation : 0,
      posted.length ? posted[posted.length - 1].accumulatedDepreciation : 0,
    );
    return Math.round((asset.cost - accumulated) * 100) / 100;
  });

  protected readonly gainLoss = computed(() =>
    Math.round(((this.value().proceeds ?? 0) - this.bookValueAtDisposal()) * 100) / 100);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    disposalDate: this.translate.instant('accounting.fixedAssets.disposalDate'),
    proceeds: this.translate.instant('accounting.fixedAssets.proceeds'),
    proceedsGlAccountId: this.translate.instant('accounting.fixedAssets.proceedsAccount'),
  });

  ngOnInit(): void {
    this.form.controls.proceeds.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((proceeds) => {
      const account = this.form.controls.proceedsGlAccountId;
      account.setValidators((proceeds ?? 0) > 0 ? [Validators.required] : []);
      account.updateValueAndValidity();
    });

    this.gl.getChartOfAccounts(this.data.detail.asset.bookId, true).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accounts) => this.accounts.set(accounts),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.errors.accountsLoadFailed'),
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }

  protected confirm(): void {
    if (this.form.invalid || this.saving()) return;
    const raw = this.form.getRawValue();
    const proceeds = raw.proceeds ?? 0;
    this.saving.set(true);
    this.service
      .dispose(this.data.detail.asset.id, {
        disposalDate: toDateOnly(raw.disposalDate) ?? '',
        proceeds,
        proceedsGlAccountId: proceeds > 0 ? raw.proceedsGlAccountId : null,
        gainLossGlAccountId: raw.gainLossGlAccountId,
        memo: raw.memo.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.snackbar.success(this.translate.instant('accounting.fixedAssets.disposed', { name: result.asset.name }));
          this.dialogRef.close(result);
        },
        error: () => this.saving.set(false),
      });
  }
}

function today(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
