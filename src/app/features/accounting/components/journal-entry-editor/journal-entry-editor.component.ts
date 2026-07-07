import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { forkJoin } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { GlAccount, LedgerRegisterPage, ManualJournalEntryInput } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;
const DEFAULT_CURRENCY_ID = 1;

/** A line must carry exactly one non-zero side (debit XOR credit). */
function lineValidator(control: AbstractControl): ValidationErrors | null {
  const debit = Number(control.get('debit')?.value) || 0;
  const credit = Number(control.get('credit')?.value) || 0;
  if (debit > 0 && credit > 0) return { bothSides: true };
  if (debit === 0 && credit === 0) return { emptyLine: true };
  return null;
}

/** The whole entry must balance: total debits === total credits, and > 0. */
function balancedValidator(group: AbstractControl): ValidationErrors | null {
  const lines = (group.get('lines') as FormArray | null)?.controls ?? [];
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    debit += Number(line.get('debit')?.value) || 0;
    credit += Number(line.get('credit')?.value) || 0;
  }
  if (debit === 0 && credit === 0) return null; // empty — the line validators speak first
  return Math.abs(debit - credit) < 0.005 ? null : { unbalanced: true };
}

/**
 * §5A manual journal-entry editor: compose and post a balanced double-entry journal. Balanced-by-
 * construction (Dr = Cr gate + live totals), memo required, accounts from the postable chart of
 * accounts. Posts via the GL posting engine (`POST /accounting/journal-entries`); corrections to
 * already-posted entries are made as new reversing entries, never by editing here.
 */
@Component({
  selector: 'app-journal-entry-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageLayoutComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    CurrencyInputComponent,
    CurrencyDisplayComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './journal-entry-editor.component.html',
  styleUrl: './journal-entry-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JournalEntryEditorComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly accountOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup(
    {
      entryDate: new FormControl<Date | null>(this.today(), [Validators.required]),
      memo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
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
    entryDate: this.translate.instant('accounting.journalEditor.date'),
    memo: this.translate.instant('accounting.journalEditor.memo'),
  });

  protected get lines(): FormArray<FormGroup> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    const accounts$ = this.gl.getChartOfAccounts(DEFAULT_BOOK_ID, true);

    // §5A "Reverse / correct": ?correctionOf=<entryId> pre-seeds the form from the original entry
    // (same lines, referencing memo) so the user fixes what was wrong and posts the replacement.
    // URL is the source of truth — a shared/bookmarked link reopens the same correction.
    // Options MUST be set before the lines are patched or the account selects render blank
    // (value-vs-options race, caught by visual verification 2026-07-07) — hence the forkJoin.
    const correctionOf = Number(this.route.snapshot.queryParamMap.get('correctionOf'));
    if (correctionOf > 0) {
      forkJoin([accounts$, this.gl.getLedgerRegister(DEFAULT_BOOK_ID, { pageSize: 100 })])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ([accounts, page]) => {
            this.accountOptions.set(accounts.map((a) => this.toOption(a)));
            this.prefillFrom(page, correctionOf);
          },
          error: () => this.snackbar.error(this.translate.instant('accounting.errors.accountsLoadFailed')),
        });
      return;
    }

    accounts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accounts) => this.accountOptions.set(accounts.map((a) => this.toOption(a))),
      error: () => this.snackbar.error(this.translate.instant('accounting.errors.accountsLoadFailed')),
    });
  }

  private prefillFrom(page: LedgerRegisterPage, entryId: number): void {
    const original = page.data.find((e) => e.id === entryId);
    if (!original) return; // fell off the first page — user composes manually
    this.form.controls.memo.setValue(
      this.translate.instant('accounting.journalEditor.correctionMemo', { number: original.entryNumber }),
    );
    // Resize then patch IN PLACE — never clear()+push(). The @for tracks $index, so replacing the
    // controls under reused rows leaves formGroupName bound to the dead controls and the inputs
    // render blank while the form state is correct (caught by visual verification 2026-07-07).
    const needed = Math.max(original.lines.length, 2);
    while (this.lines.length > needed) this.lines.removeAt(this.lines.length - 1);
    while (this.lines.length < needed) this.lines.push(this.buildLine());
    original.lines.forEach((line, i) =>
      this.lines.at(i).patchValue({
        glAccountId: line.glAccountId,
        debit: line.debit || null,
        credit: line.credit || null,
        description: line.description ?? '',
      }),
    );
    this.form.markAsDirty();
  }

  protected addLine(): void {
    this.lines.push(this.buildLine());
    this.form.markAsDirty();
  }

  protected removeLine(index: number): void {
    if (this.lines.length <= 2) return; // keep at least a balanced pair
    this.lines.removeAt(index);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const request: ManualJournalEntryInput = {
      bookId: DEFAULT_BOOK_ID,
      currencyId: DEFAULT_CURRENCY_ID,
      entryDate: (toIsoDate(raw.entryDate) ?? '').slice(0, 10),
      memo: raw.memo.trim(),
      allowSoftClosedOverride: false,
      lines: this.lines.controls.map((control) => {
        const line = control.getRawValue() as {
          glAccountId: number | null;
          debit: number | null;
          credit: number | null;
          description: string;
        };
        return {
          glAccountId: line.glAccountId as number,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          description: line.description?.trim() || null,
        };
      }),
    };
    this.gl
      .createManualJournalEntry(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.snackbar.success(this.translate.instant('accounting.journalEditor.posted', { number: result.entryNumber }));
          this.router.navigate(['/accounting/ledger']);
        },
        error: () => this.saving.set(false),
      });
  }

  protected cancel(): void {
    this.router.navigate(['/accounting/ledger']);
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

  private toOption(account: GlAccount): SelectOption {
    return { value: account.id, label: `${account.accountNumber} — ${account.name}` };
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
