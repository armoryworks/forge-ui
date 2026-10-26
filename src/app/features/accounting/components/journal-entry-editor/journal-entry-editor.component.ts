import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { parseDateOnly, toIsoDate } from '../../../../shared/utils/date.utils';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { HasDirtyForm } from '../../../../shared/guards/unsaved-changes.guard';
import { GlAccount, LedgerRegisterEntry, LedgerRegisterPage, ManualJournalEntryInput } from '../../models/accounting.models';
import { balancedValidator, lineValidator } from '../../utils/journal-line.validators';

const DEFAULT_BOOK_ID = 1; // overridable via ?bookId= (training sandbox, §5A.4)
const DEFAULT_CURRENCY_ID = 1;

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
export class JournalEntryEditorComponent implements OnInit, HasDirtyForm {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  private bookId = DEFAULT_BOOK_ID;
  protected readonly accountOptions = signal<SelectOption[]>([]);
  /** §5A.2 split-pane: the entry being corrected stays pinned above the compose form. */
  protected readonly original = signal<LedgerRegisterEntry | null>(null);
  /** A rejected draft being edited: saving resubmits it in place (same entry number) for approval. */
  protected readonly resubmitting = signal(false);

  protected readonly form = new FormGroup(
    {
      entryDate: new FormControl<Date | null>(this.today(), [Validators.required]),
      memo: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
      lines: new FormArray<FormGroup>([this.buildLine(), this.buildLine()]),
    },
    { validators: [balancedValidator(() => this.translate.instant('accounting.journalEditor.outOfBalanceViolation'))] },
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
    const book = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.bookId = book > 0 ? book : DEFAULT_BOOK_ID;
    const accounts$ = this.gl.getChartOfAccounts(this.bookId, true);

    // §5A "Reverse / correct": ?correctionOf=<entryId> pre-seeds the form from the original entry
    // (same lines, referencing memo) so the user fixes what was wrong and posts the replacement.
    // URL is the source of truth — a shared/bookmarked link reopens the same correction.
    // Options MUST be set before the lines are patched or the account selects render blank
    // (value-vs-options race, caught by visual verification 2026-07-07) — hence the forkJoin.
    const correctionOf = Number(this.route.snapshot.queryParamMap.get('correctionOf'));
    const resubmitOf = Number(this.route.snapshot.queryParamMap.get('resubmitOf'));
    const sourceId = resubmitOf > 0 ? resubmitOf : correctionOf;
    if (sourceId > 0) {
      const filter = resubmitOf > 0 ? { pageSize: 100, status: 'Draft' as const } : { pageSize: 100 };
      forkJoin([accounts$, this.gl.getLedgerRegister(this.bookId, filter)])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: ([accounts, page]) => {
            this.accountOptions.set(accounts.map((a) => this.toOption(a)));
            if (resubmitOf > 0) this.prefillResubmit(page, resubmitOf);
            else this.prefillFrom(page, correctionOf);
          },
          error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.errors.accountsLoadFailed'),
        });
      return;
    }

    accounts$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (accounts) => this.accountOptions.set(accounts.map((a) => this.toOption(a))),
      error: (err: unknown) => this.snackbar.errorFrom(err, 'accounting.errors.accountsLoadFailed'),
    });
  }

  isDirty(): boolean {
    return this.form.dirty && !this.saving();
  }

  private prefillResubmit(page: LedgerRegisterPage, entryId: number): void {
    const draft = page.data.find((e) => e.id === entryId);
    if (!draft) return;
    this.resubmitting.set(true);
    this.original.set(draft);
    this.form.controls.memo.setValue((draft.memo ?? '').replace(/\s*(?:—\s*)?\[Rejected\].*$/, ''));
    this.form.controls.entryDate.setValue(parseDateOnly(draft.entryDate));
    this.patchLines(draft);
  }

  private prefillFrom(page: LedgerRegisterPage, entryId: number): void {
    const original = page.data.find((e) => e.id === entryId);
    if (!original) return; // fell off the first page — user composes manually
    this.original.set(original);
    this.form.controls.memo.setValue(
      this.translate.instant('accounting.journalEditor.correctionMemo', { number: original.entryNumber }),
    );
    this.patchLines(original);
  }

  private patchLines(original: LedgerRegisterEntry): void {
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
      bookId: this.bookId,
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
    const draft = this.resubmitting() ? this.original() : null;
    const save$ = draft
      ? this.gl.resubmitJournalEntry(draft.id, request)
      : this.gl.createManualJournalEntry(request);
    save$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.form.markAsPristine();
          if (result.status === 'PendingApproval') {
            this.snackbar.info(this.translate.instant('accounting.journalEditor.pendingApproval', { number: result.entryNumber }));
            this.router.navigate(['/accounting/journal-approvals']);
            return;
          }
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
