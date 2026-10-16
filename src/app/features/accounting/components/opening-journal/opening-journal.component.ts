import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { switchMap } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { AccountingConversionService } from '../../services/accounting-conversion.service';
import { GlAccount, TrialBalance } from '../../models/accounting.models';
import { ConversionStatus } from '../../models/conversion-status.model';
import { OpeningJournalInput } from '../../models/opening-journal-input.model';
import { balancedValidator, lineValidator } from '../../utils/journal-line.validators';
import { parseOpeningJournalCsv } from '../../utils/opening-journal-csv';

/**
 * §7A opening journal: the one balanced Source=Conversion entry that carries a book's opening balances
 * into the ledger and unlocks CAP-ACCT-FULLGL. Lines are keyed in or pasted from the cutover CSV
 * template (`accountNumber, debit, credit, description`). Once posted the page shows the entry and the
 * native trial balance to tie out against the legacy closing balances. Reachable under
 * CAP-ACCT-MIGRATION, before the GL view exists.
 */
@Component({
  selector: 'app-opening-journal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    PageLayoutComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    CurrencyInputComponent,
    CurrencyDisplayComponent,
    ValidationButtonComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './opening-journal.component.html',
  styleUrl: './opening-journal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningJournalComponent implements OnInit {
  private readonly conversion = inject(AccountingConversionService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isAdmin = inject(AuthService).hasAnyRole(['Admin']);
  protected readonly loading = signal(true);
  protected readonly posting = signal(false);
  protected readonly status = signal<ConversionStatus | null>(null);
  protected readonly accounts = signal<GlAccount[]>([]);
  protected readonly tieOut = signal<TrialBalance | null>(null);
  protected readonly openingDateLabel = computed(() => {
    const iso = this.status()?.openingEntryDate;
    if (!iso) return '';
    const [year, month, day] = iso.slice(0, 10).split('-');
    return `${month}/${day}/${year}`;
  });
  protected readonly accountOptions = computed<SelectOption[]>(() =>
    this.accounts().map((a) => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })),
  );

  protected readonly csvControl = new FormControl<string>('', { nonNullable: true });
  protected readonly form = new FormGroup(
    {
      asOfDate: new FormControl<Date | null>(null, [Validators.required]),
      lines: new FormArray<FormGroup>([this.buildLine(), this.buildLine()]),
    },
    { validators: [balancedValidator] },
  );

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly totalDebit = computed(() => this.sideTotal('debit'));
  protected readonly totalCredit = computed(() => this.sideTotal('credit'));
  protected readonly balanced = computed(() => {
    const debit = this.totalDebit();
    return debit > 0 && Math.abs(debit - this.totalCredit()) < 0.005;
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    asOfDate: this.translate.instant('accounting.openingJournal.asOfDate'),
  });

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    const requested = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.conversion.getStatus(requested > 0 ? requested : null)
      .pipe(
        switchMap((status) => {
          this.status.set(status);
          if (status.openingJournalPosted) this.loadTieOut(status);
          return this.conversion.getAccounts(status.bookId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (accounts) => {
          this.accounts.set(accounts);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.openingJournal.loadFailed');
        },
      });
  }

  protected addLine(): void {
    this.lines.push(this.buildLine());
    this.form.markAsDirty();
  }

  protected removeLine(index: number): void {
    if (this.lines.length <= 2) return;
    this.lines.removeAt(index);
    this.form.markAsDirty();
  }

  protected loadCsv(): void {
    const parsed = parseOpeningJournalCsv(this.csvControl.value);
    if (parsed.badLineNumbers.length > 0) {
      this.snackbar.error(this.translate.instant('accounting.openingJournal.csvBadRows', {
        rows: parsed.badLineNumbers.join(', '),
      }));
      return;
    }
    const idByNumber = new Map(this.accounts().map((a) => [a.accountNumber, a.id]));
    const unknown = [...new Set(parsed.lines.map((l) => l.accountNumber).filter((n) => !idByNumber.has(n)))];
    if (unknown.length > 0) {
      this.snackbar.error(this.translate.instant('accounting.openingJournal.csvUnknownAccounts', {
        accounts: unknown.join(', '),
      }));
      return;
    }
    if (parsed.lines.length < 2) {
      this.snackbar.error(this.translate.instant('accounting.openingJournal.csvTooFew'));
      return;
    }
    const needed = parsed.lines.length;
    while (this.lines.length > needed) this.lines.removeAt(this.lines.length - 1);
    while (this.lines.length < needed) this.lines.push(this.buildLine());
    parsed.lines.forEach((line, i) =>
      this.lines.at(i).patchValue({
        glAccountId: idByNumber.get(line.accountNumber),
        debit: line.debit || null,
        credit: line.credit || null,
        description: line.description ?? '',
      }),
    );
    this.form.markAsDirty();
    this.csvControl.setValue('');
    this.snackbar.success(this.translate.instant('accounting.openingJournal.csvLoaded', { count: needed }));
  }

  protected post(): void {
    const status = this.status();
    if (!status || this.form.invalid || this.posting()) return;
    const numberById = new Map(this.accounts().map((a) => [a.id, a.accountNumber]));
    const raw = this.form.getRawValue();
    const request: OpeningJournalInput = {
      bookId: status.bookId,
      currencyId: status.functionalCurrencyId,
      asOfDate: (toIsoDate(raw.asOfDate) ?? '').slice(0, 10),
      lines: this.lines.controls.map((control) => {
        const line = control.getRawValue() as {
          glAccountId: number;
          debit: number | null;
          credit: number | null;
          description: string;
        };
        return {
          accountNumber: numberById.get(line.glAccountId) ?? '',
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          description: line.description?.trim() || null,
        };
      }),
    };
    this.posting.set(true);
    this.conversion.importOpeningJournal(request)
      .pipe(
        switchMap((result) => {
          this.snackbar.success(this.translate.instant('accounting.openingJournal.posted', { number: result.entryNumber }));
          return this.conversion.getStatus(status.bookId);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (fresh) => {
          this.posting.set(false);
          this.status.set(fresh);
          this.loadTieOut(fresh);
        },
        error: () => this.posting.set(false),
      });
  }

  private loadTieOut(status: ConversionStatus): void {
    this.conversion.getTieOut(status.bookId, status.openingEntryDate)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tb) => this.tieOut.set(tb),
        error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.openingJournal.tieOutFailed'),
      });
  }

  private sideTotal(side: 'debit' | 'credit'): number {
    const lines = (this.formValue()?.lines ?? []) as Array<{ debit?: number | null; credit?: number | null }>;
    return lines.reduce((acc, line) => acc + (Number(line[side]) || 0), 0);
  }

  private buildLine(): FormGroup {
    return new FormGroup(
      {
        glAccountId: new FormControl<number | null>(null, [Validators.required]),
        debit: new FormControl<number | null>(null),
        credit: new FormControl<number | null>(null),
        description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
      },
      { validators: [lineValidator] },
    );
  }
}
