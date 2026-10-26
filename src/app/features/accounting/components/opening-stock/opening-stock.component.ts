import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Observable } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { downloadCsv } from '../../../../shared/utils/download-csv';
import { parseServerValidationEnvelope } from '../../../../shared/utils/server-validation.utils';
import { AccountingStockLoadService } from '../../services/accounting-stock-load.service';
import { InventoryValuationReconciliation } from '../../models/inventory-valuation.model';
import { StockLoad, StockLoadGlMode, StockLoadInput, StockLoadLine, StockLoadSummary } from '../../models/stock-load.model';
import { StockLoadContext, StockLoadIssue, StockLoadValidationResult } from '../../models/stock-load-validation.model';
import { STOCK_LOAD_TEMPLATE_EXAMPLE, STOCK_LOAD_TEMPLATE_HEADER } from '../../utils/stock-load-template';
import { StockLoadRowError, stockLoadRowErrors } from '../../utils/stock-load-row-errors';

/** A stock-load line with the dry run's findings for it, worded for the grid. */
interface StockLoadGridRow extends StockLoadLine {
  errors: string;
  warnings: string;
}

/**
 * §7A opening stock: load opening inventory as quantity and cutover unit cost per part, location and lot, from
 * the CSV template. A draft is saved, dry-run (per-line errors and warnings, totals per inventory account) and
 * posted: bins, lots, the valuation store and Dr inventory / Cr Opening Balance Equity, so stock and the ledger
 * agree. "Valuation only" is offered when the posted opening journal already debited inventory. A posted load can
 * be voided while its stock is untouched. Controller; CAP-ACCT-MIGRATION or CAP-ACCT-FULLGL.
 */
@Component({
  selector: 'app-opening-stock',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    PageLayoutComponent,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    CurrencyDisplayComponent,
    ValidationButtonComponent,
    LoadingBlockDirective,
    DataTableComponent,
    ColumnCellDirective,
  ],
  templateUrl: './opening-stock.component.html',
  styleUrl: './opening-stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningStockComponent implements OnInit {
  private readonly stockLoads = inject(AccountingStockLoadService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly context = signal<StockLoadContext | null>(null);
  protected readonly loads = signal<StockLoadSummary[]>([]);
  protected readonly selected = signal<StockLoad | null>(null);
  protected readonly validation = signal<StockLoadValidationResult | null>(null);
  protected readonly rowErrors = signal<StockLoadRowError[]>([]);
  protected readonly reconciliation = signal<InventoryValuationReconciliation | null>(null);
  protected readonly csvText = signal<string | null>(null);
  protected readonly fileName = signal<string | null>(null);

  protected readonly form = new FormGroup({
    asOfDate: new FormControl<Date | null>(null, [Validators.required]),
    glMode: new FormControl<StockLoadGlMode>('OffsetEquity', { nonNullable: true }),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    asOfDate: this.translate.instant('accounting.openingStock.asOfDate'),
    notes: this.translate.instant('accounting.openingStock.notes'),
  });

  protected readonly isDraft = computed(() => (this.selected()?.status ?? 'Draft') === 'Draft');
  protected readonly canSave = computed(() => this.isDraft() && (this.selected() !== null || this.csvText() !== null));
  protected readonly hasOpeningInventory = computed(() => (this.context()?.openingJournalInventory.length ?? 0) > 0);
  protected readonly modeOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [
      { value: 'OffsetEquity', label: this.translate.instant('accounting.openingStock.modeOffsetEquity') },
    ];
    if (this.hasOpeningInventory() || this.selected()?.glMode === 'ValuationOnly') {
      options.push({ value: 'ValuationOnly', label: this.translate.instant('accounting.openingStock.modeValuationOnly') });
    }
    return options;
  });
  protected readonly loadIssues = computed(() => [
    ...(this.validation()?.issues ?? []).filter((i) => i.lineNumber === 0).map((i) => ({ severity: i.severity, text: this.issueText(i) })),
    ...this.rowErrors().filter((e) => e.row === 0).map((e) => ({ severity: 'Error' as const, text: e.message })),
  ]);
  protected readonly unsavedRowErrors = computed(() => this.rowErrors().filter((e) => e.row > 0));
  protected readonly gridRows = computed<StockLoadGridRow[]>(() => {
    const issues = this.validation()?.issues ?? [];
    return (this.selected()?.lines ?? []).map((line) => {
      const mine = issues.filter((i) => i.lineNumber === line.lineNumber);
      const serverErrors = this.rowErrors().filter((e) => e.row === line.lineNumber).map((e) => e.message);
      return {
        ...line,
        errors: [...mine.filter((i) => i.severity === 'Error').map((i) => this.issueText(i)), ...serverErrors].join(' '),
        warnings: mine.filter((i) => i.severity === 'Warning').map((i) => this.issueText(i)).join(' '),
      };
    });
  });
  protected readonly canPost = computed(() =>
    this.selected()?.status === 'Draft' && this.validation()?.isValid === true && !this.form.dirty && this.csvText() === null);

  protected readonly loadColumns: ColumnDef[] = [
    { field: 'loadNumber', header: this.translate.instant('accounting.openingStock.loadNumber'), sortable: true, width: '130px' },
    { field: 'asOfDate', header: this.translate.instant('accounting.openingStock.asOfDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'status', header: this.translate.instant('accounting.openingStock.status'), sortable: true, width: '110px' },
    { field: 'glMode', header: this.translate.instant('accounting.openingStock.mode'), sortable: true },
    { field: 'lineCount', header: this.translate.instant('accounting.openingStock.lineCount'), sortable: true, type: 'number', align: 'right', width: '90px' },
    { field: 'totalValue', header: this.translate.instant('accounting.openingStock.totalValue'), sortable: true, type: 'number', align: 'right', width: '150px' },
  ];

  protected readonly lineColumns: ColumnDef[] = [
    { field: 'lineNumber', header: '#', sortable: true, type: 'number', width: '60px' },
    { field: 'partNumber', header: this.translate.instant('accounting.openingStock.part'), sortable: true },
    { field: 'locationName', header: this.translate.instant('accounting.openingStock.location'), sortable: true },
    { field: 'lotNumber', header: this.translate.instant('accounting.openingStock.lot'), sortable: true, width: '110px' },
    { field: 'quantity', header: this.translate.instant('accounting.openingStock.quantity'), sortable: true, type: 'number', align: 'right', width: '100px' },
    { field: 'unitCost', header: this.translate.instant('accounting.openingStock.unitCost'), sortable: true, type: 'number', align: 'right', width: '120px' },
    { field: 'extendedValue', header: this.translate.instant('accounting.openingStock.extendedValue'), sortable: true, type: 'number', align: 'right', width: '140px' },
    { field: 'errors', header: this.translate.instant('accounting.openingStock.errors') },
    { field: 'warnings', header: this.translate.instant('accounting.openingStock.warnings') },
  ];

  ngOnInit(): void {
    const requested = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.stockLoads.getContext(requested > 0 ? requested : null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (context) => {
          this.context.set(context);
          this.form.controls.asOfDate.setValue(context.openingJournalDate ? this.toDate(context.openingJournalDate) : null);
          this.form.markAsPristine();
          this.refreshList();
          this.loadReconciliation();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.snackbar.errorFrom(err, 'accounting.openingStock.loadFailed');
        },
      });
  }

  protected newLoad(): void {
    this.selected.set(null);
    this.validation.set(null);
    this.rowErrors.set([]);
    this.clearFile();
    const date = this.context()?.openingJournalDate;
    this.form.reset({ asOfDate: date ? this.toDate(date) : null, glMode: 'OffsetEquity', notes: '' });
  }

  protected selectLoad(row: StockLoadSummary): void {
    this.busy.set(true);
    this.stockLoads.get(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (load) => {
        this.busy.set(false);
        this.show(load);
      },
      error: () => this.busy.set(false),
    });
  }

  protected pickFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.csvText.set(await file.text());
    this.fileName.set(file.name);
    this.rowErrors.set([]);
  }

  protected clearFile(): void {
    this.csvText.set(null);
    this.fileName.set(null);
  }

  protected downloadTemplate(): void {
    downloadCsv([[...STOCK_LOAD_TEMPLATE_HEADER], [...STOCK_LOAD_TEMPLATE_EXAMPLE]], 'opening-stock-template');
  }

  protected save(): void {
    const context = this.context();
    if (!context || this.form.invalid || !this.canSave() || this.busy()) return;
    const current = this.selected();
    const raw = this.form.getRawValue();
    const input: StockLoadInput = {
      bookId: context.bookId,
      asOfDate: (toIsoDate(raw.asOfDate) ?? '').slice(0, 10),
      glMode: raw.glMode,
      notes: raw.notes.trim() || null,
      sourceFileName: this.fileName() ?? current?.sourceFileName ?? null,
      csvContent: this.csvText(),
      lines: this.csvText() === null && current
        ? current.lines.map((l) => ({
          partId: l.partId, storageLocationId: l.storageLocationId, lotNumber: l.lotNumber,
          expirationDate: l.expirationDate, quantity: l.quantity, unitCost: l.unitCost,
        }))
        : undefined,
    };
    const request = current ? this.stockLoads.update(current.id, input) : this.stockLoads.create(input);
    this.run(request, (load) => {
      this.clearFile();
      this.snackbar.success(this.translate.instant('accounting.openingStock.saved', { number: load.loadNumber }));
      this.show(load);
      this.refreshList();
    });
  }

  protected validate(): void {
    const load = this.selected();
    if (!load) return;
    this.busy.set(true);
    this.stockLoads.validate(load.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.validation.set(result);
      },
      error: () => this.busy.set(false),
    });
  }

  protected post(): void {
    const load = this.selected();
    if (!load || !this.canPost()) return;
    this.run(this.stockLoads.post(load.id), (posted) => {
      this.snackbar.success(this.translate.instant('accounting.openingStock.posted', { number: posted.loadNumber }));
      this.show(posted);
      this.refreshList();
      this.loadReconciliation();
    });
  }

  protected voidLoad(): void {
    const load = this.selected();
    if (!load || load.status !== 'Posted') return;
    this.confirm('accounting.openingStock.voidTitle', 'accounting.openingStock.voidMessage', 'accounting.openingStock.void', load.loadNumber)
      .subscribe((ok) => {
        if (!ok) return;
        this.run(this.stockLoads.void(load.id), (voided) => {
          this.snackbar.success(this.translate.instant('accounting.openingStock.voided', { number: voided.loadNumber }));
          this.show(voided);
          this.refreshList();
          this.loadReconciliation();
        });
      });
  }

  protected deleteLoad(): void {
    const load = this.selected();
    if (!load || load.status !== 'Draft') return;
    this.confirm('accounting.openingStock.deleteTitle', 'accounting.openingStock.deleteMessage', 'common.delete', load.loadNumber)
      .subscribe((ok) => {
        if (!ok) return;
        this.busy.set(true);
        this.stockLoads.delete(load.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.busy.set(false);
            this.newLoad();
            this.refreshList();
          },
          error: () => this.busy.set(false),
        });
      });
  }

  private run(request: Observable<StockLoad>, done: (load: StockLoad) => void): void {
    this.busy.set(true);
    this.rowErrors.set([]);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (load) => {
        this.busy.set(false);
        done(load);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const errors = parseServerValidationEnvelope(err);
        if (errors) {
          this.rowErrors.set(stockLoadRowErrors(errors).map((e) => ({ ...e, message: this.codeText(e.code, e.message) })));
          this.snackbar.error(this.translate.instant('accounting.openingStock.rowErrors', { count: errors.length }));
        }
      },
    });
  }

  private show(load: StockLoad): void {
    this.selected.set(load);
    this.validation.set(null);
    this.form.reset({ asOfDate: this.toDate(load.asOfDate), glMode: load.glMode, notes: load.notes ?? '' });
    if (load.status === 'Draft') this.validate();
  }

  private refreshList(): void {
    const context = this.context();
    if (!context) return;
    this.stockLoads.list(context.bookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (loads) => {
        this.loads.set(loads);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.snackbar.errorFrom(err, 'accounting.openingStock.loadFailed');
      },
    });
  }

  private loadReconciliation(): void {
    const context = this.context();
    if (!context) return;
    this.stockLoads.getReconciliation(context.bookId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rec) => this.reconciliation.set(rec),
      error: () => this.reconciliation.set(null),
    });
  }

  private confirm(titleKey: string, messageKey: string, confirmKey: string, number: string): Observable<boolean> {
    return this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant(titleKey, { number }),
        message: this.translate.instant(messageKey, { number }),
        confirmLabel: this.translate.instant(confirmKey),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed() as Observable<boolean>;
  }

  private issueText(issue: StockLoadIssue): string {
    return this.codeText(issue.code, issue.message);
  }

  private codeText(code: string | null, fallback: string): string {
    if (!code) return fallback;
    const key = `accounting.openingStock.issues.${code.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`;
    const text = this.translate.instant(key);
    return text && text !== key ? text : fallback;
  }

  private toDate(iso: string): Date {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}
