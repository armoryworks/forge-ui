import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { HasDirtyForm } from '../../../../shared/guards/unsaved-changes.guard';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { downloadCsv } from '../../../../shared/utils/download-csv';
import { parseDateOnly, toIsoDate } from '../../../../shared/utils/date.utils';
import { OpeningOpenItemsService } from '../../services/opening-open-items.service';
import { OpeningOpenItem } from '../../models/opening-open-item.model';
import { OpeningOpenItemsValidation } from '../../models/opening-open-items-validation.model';
import {
  OPENING_OPEN_ITEMS_TEMPLATE_EXAMPLES,
  OPENING_OPEN_ITEMS_TEMPLATE_HEADER,
  parseOpeningOpenItemsCsv,
} from '../../utils/opening-open-items-csv';
import { openingOpenItemsLines, tieOutDifference } from '../../utils/opening-open-items-lines';
import { pickFile } from '../../utils/pick-file';

const DEFAULT_BOOK_ID = 1;

/** One grid row as the form holds it. */
interface OpenItemRowValue {
  partyType: 'Customer' | 'Vendor';
  partyRef: string;
  documentNumber: string;
  documentDate: Date | null;
  dueDate: Date | null;
  amount: number | null;
  description: string;
}

/**
 * §7A opening receivables and payables: the customer invoices and vendor bills still open at cutover, keyed
 * or imported from the CSV template, checked by the server (party, amount, dates, document number) and tied
 * out against the legacy AR and AP control balances before they post as the book's opening-balance entry
 * (party lines on AR/AP control, the net to Opening Balance Equity). Each posted item becomes an open invoice
 * or bill that ages, takes payment and appears on the customer statement.
 */
@Component({
  selector: 'app-opening-open-items',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    CurrencyPipe,
    PageLayoutComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    CurrencyInputComponent,
    ValidationButtonComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './opening-open-items.component.html',
  styleUrl: './opening-open-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningOpenItemsComponent implements OnInit, HasDirtyForm {
  private readonly service = inject(OpeningOpenItemsService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private bookId = DEFAULT_BOOK_ID;
  protected readonly checking = signal(false);
  protected readonly posting = signal(false);
  protected readonly check = signal<OpeningOpenItemsValidation | null>(null);
  protected readonly postedEntryNumber = signal<number | null>(null);

  protected readonly partyTypeOptions: SelectOption[] = [
    { value: 'Customer', label: this.translate.instant('accounting.openItems.receivable') },
    { value: 'Vendor', label: this.translate.instant('accounting.openItems.payable') },
  ];

  protected readonly form = new FormGroup({
    asOfDate: new FormControl<Date | null>(null, [Validators.required]),
    receivablesControl: new FormControl<number | null>(null, [Validators.required]),
    payablesControl: new FormControl<number | null>(null, [Validators.required]),
    rows: new FormArray<FormGroup>([this.buildRow()]),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  private readonly rowValues = computed(() => (this.formValue().rows ?? []) as Partial<OpenItemRowValue>[]);
  protected readonly receivablesTotal = computed(() => this.sideTotal('Customer'));
  protected readonly payablesTotal = computed(() => this.sideTotal('Vendor'));
  protected readonly receivablesDifference = computed(() =>
    tieOutDifference(this.receivablesTotal(), this.formValue().receivablesControl ?? null));
  protected readonly payablesDifference = computed(() =>
    tieOutDifference(this.payablesTotal(), this.formValue().payablesControl ?? null));
  protected readonly tiesOut = computed(() => this.receivablesDifference() === 0 && this.payablesDifference() === 0);
  protected readonly rowResults = computed(() => {
    const rows = this.check()?.rows ?? [];
    return rows.map((r) => ({
      ...r,
      messages: r.errors.map((code) => this.translate.instant(`accounting.openItems.errors.${code}`)),
    }));
  });
  protected readonly checkedClean = computed(() => {
    const check = this.check();
    return !!check && check.errorCount === 0 && !check.alreadyPosted;
  });
  protected readonly canPost = computed(() =>
    this.checkedClean() && this.tiesOut() && !this.posting() && this.postedEntryNumber() === null);

  protected readonly violations = FormValidationService.getViolations(this.form, {
    asOfDate: this.translate.instant('accounting.openItems.asOfDate'),
    receivablesControl: this.translate.instant('accounting.openItems.receivablesControl'),
    payablesControl: this.translate.instant('accounting.openItems.payablesControl'),
  });

  protected get rows(): FormArray<FormGroup> {
    return this.form.controls.rows;
  }

  ngOnInit(): void {
    const book = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.bookId = book > 0 ? book : DEFAULT_BOOK_ID;
    this.form.controls.rows.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.check.set(null));
  }

  isDirty(): boolean {
    return this.form.dirty && !this.posting();
  }

  protected addRow(): void {
    this.rows.push(this.buildRow());
    this.form.markAsDirty();
  }

  protected removeRow(index: number): void {
    if (this.rows.length <= 1) return;
    this.rows.removeAt(index);
    this.form.markAsDirty();
  }

  protected downloadTemplate(): void {
    downloadCsv(
      [[...OPENING_OPEN_ITEMS_TEMPLATE_HEADER], ...OPENING_OPEN_ITEMS_TEMPLATE_EXAMPLES.map((row) => [...row])],
      'opening-open-items-template',
    );
  }

  protected importCsv(): void {
    pickFile('.csv,text/csv', (file) => {
      void file.text().then((text) => this.loadCsv(text));
    });
  }

  protected loadCsv(text: string): void {
    const parsed = parseOpeningOpenItemsCsv(text);
    if (parsed.badLineNumbers.length > 0) {
      this.snackbar.error(this.translate.instant('accounting.openItems.csvBadRows', { rows: parsed.badLineNumbers.join(', ') }));
      return;
    }
    if (parsed.rows.length === 0) {
      this.snackbar.error(this.translate.instant('accounting.openItems.csvEmpty'));
      return;
    }
    while (this.rows.length > parsed.rows.length) this.rows.removeAt(this.rows.length - 1);
    while (this.rows.length < parsed.rows.length) this.rows.push(this.buildRow());
    parsed.rows.forEach((row, i) =>
      this.rows.at(i).patchValue({
        partyType: row.partyType,
        partyRef: row.partyRef ?? '',
        documentNumber: row.documentNumber ?? '',
        documentDate: row.documentDate ? parseDateOnly(row.documentDate) : null,
        dueDate: row.dueDate ? parseDateOnly(row.dueDate) : null,
        amount: row.amount,
        description: row.description ?? '',
      }),
    );
    this.form.markAsDirty();
    this.snackbar.success(this.translate.instant('accounting.openItems.csvLoaded', { count: parsed.rows.length }));
  }

  protected runCheck(): void {
    if (this.checking()) return;
    this.checking.set(true);
    this.service.validate(this.bookId, this.items())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.check.set(result);
          this.checking.set(false);
        },
        error: (err: unknown) => {
          this.checking.set(false);
          this.snackbar.errorFrom(err, 'accounting.openItems.checkFailed');
        },
      });
  }

  protected post(): void {
    const check = this.check();
    if (!check || !this.canPost() || this.form.invalid) return;
    const asOf = (toIsoDate(this.form.controls.asOfDate.value) ?? '').slice(0, 10);
    const lines = openingOpenItemsLines(this.items(), check.rows.map((r) => r.partyId));
    this.posting.set(true);
    this.service.post(this.bookId, asOf, lines)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.posting.set(false);
          this.postedEntryNumber.set(result.entryNumber);
          this.form.markAsPristine();
          this.snackbar.success(this.translate.instant('accounting.openItems.posted', { number: result.entryNumber }));
        },
        error: () => this.posting.set(false),
      });
  }

  private items(): OpeningOpenItem[] {
    return this.rows.controls.map((control) => {
      const row = control.getRawValue() as OpenItemRowValue;
      return {
        partyType: row.partyType,
        partyId: null,
        partyRef: row.partyRef.trim() || null,
        documentNumber: row.documentNumber.trim() || null,
        documentDate: toIsoDate(row.documentDate)?.slice(0, 10) ?? null,
        dueDate: toIsoDate(row.dueDate)?.slice(0, 10) ?? null,
        amount: Number(row.amount) || 0,
        description: row.description.trim() || null,
      };
    });
  }

  private sideTotal(side: 'Customer' | 'Vendor'): number {
    const total = this.rowValues()
      .filter((r) => r.partyType === side)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return Math.round(total * 100) / 100;
  }

  private buildRow(): FormGroup {
    return new FormGroup({
      partyType: new FormControl<'Customer' | 'Vendor'>('Customer', { nonNullable: true }),
      partyRef: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
      documentNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(60)] }),
      documentDate: new FormControl<Date | null>(null),
      dueDate: new FormControl<Date | null>(null),
      amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
      description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    });
  }
}
