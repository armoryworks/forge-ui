import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, concatMap, from, last } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { CurrencyInputComponent } from '../../../../shared/components/currency-input/currency-input.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { autoRefreshOnGlChange } from '../../../../shared/utils/accounting-auto-refresh.util';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import {
  BankReconciliationSummary,
  BankReconciliationWorksheet,
  CashAccountModel,
} from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;

@Component({
  selector: 'app-bank-rec',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    PageHeaderComponent,
    CurrencyDisplayComponent,
    DataTableComponent,
    ColumnCellDirective,
    SelectComponent,
    DatepickerComponent,
    CurrencyInputComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './bank-rec.component.html',
  styleUrl: './bank-rec.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankRecComponent implements OnInit {
  private readonly gl = inject(GeneralLedgerService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly cashAccounts = signal<CashAccountModel[]>([]);
  protected readonly reconciliations = signal<BankReconciliationSummary[]>([]);
  protected readonly worksheet = signal<BankReconciliationWorksheet | null>(null);

  // Transient, client-only "cleared" selection (set of journal-line ids). Ticking a row mutates only
  // this set — nothing persists until the user clicks "Update cleared". Seeded from the saved isCleared
  // state whenever a worksheet loads so reopening a draft shows what is already cleared.
  protected readonly selectedLineIds = signal<ReadonlySet<number>>(new Set());

  /** Lines whose local tick differs from the server's saved cleared flag — drives the Update-cleared button. */
  protected readonly dirtyCount = computed(() => {
    const ws = this.worksheet();
    if (!ws) return 0;
    const sel = this.selectedLineIds();
    return ws.items.filter((i) => sel.has(i.journalLineId) !== i.isCleared).length;
  });

  /** Why Finalize is blocked — surfaced via the validation-button stereotype on the disabled button. */
  protected readonly finalizeViolations = computed<string[]>(() => {
    const ws = this.worksheet();
    if (!ws || ws.status !== 'Draft') return [];
    if (this.dirtyCount() > 0) return [this.translate.instant('accounting.bankRec.saveSelectionFirst')];
    if (!ws.isReconciled) return [this.translate.instant('accounting.bankRec.differenceMustBeZero')];
    return [];
  });

  // Start-new form (reactive — no ngModel).
  protected readonly startForm = new FormGroup({
    cashAccountId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    statementDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    endingBalance: new FormControl<number | null>(0),
  });

  protected readonly startViolations = FormValidationService.getViolations(this.startForm, {
    cashAccountId: this.translate.instant('accounting.bankRec.cashAccount'),
    statementDate: this.translate.instant('accounting.bankRec.statementDate'),
  });

  protected readonly cashAccountOptions = computed<SelectOption[]>(() =>
    this.cashAccounts().map((a) => ({ value: a.glAccountId, label: `${a.accountNumber} · ${a.name}` })));

  protected readonly reconColumns: ColumnDef[] = [
    { field: 'cashAccountName', header: this.translate.instant('accounting.bankRec.account'), sortable: true },
    { field: 'statementDate', header: this.translate.instant('accounting.bankRec.statementDate'), sortable: true, type: 'date', width: '150px' },
    { field: 'statementEndingBalance', header: this.translate.instant('accounting.bankRec.endingBalance'), sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'status', header: this.translate.instant('accounting.common.status'), sortable: true, width: '120px' },
    { field: 'difference', header: this.translate.instant('accounting.bankRec.difference'), sortable: true, type: 'number', align: 'right', width: '140px' },
  ];

  protected readonly itemColumns: ColumnDef[] = [
    { field: 'isCleared', header: this.translate.instant('accounting.bankRec.cleared'), align: 'center', width: '90px' },
    { field: 'entryDate', header: this.translate.instant('accounting.common.date'), sortable: true, type: 'date', width: '130px' },
    { field: 'description', header: this.translate.instant('accounting.common.description'), sortable: true },
    { field: 'amount', header: this.translate.instant('accounting.common.amount'), sortable: true, type: 'number', align: 'right', width: '140px' },
  ];

  constructor() {
    // Auto-refresh the reconciliations LIST on any GL change; never the open worksheet (would discard the
    // in-progress, unsaved cleared selection).
    autoRefreshOnGlChange(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.gl.getCashAccounts(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.cashAccounts.set(a);
        if (a.length && this.startForm.controls.cashAccountId.value == null) {
          this.startForm.controls.cashAccountId.setValue(a[0].glAccountId);
        }
      },
      error: () => this.error.set(this.translate.instant('accounting.errors.cashAccountsLoadFailed')),
    });
    this.gl.getBankReconciliations(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.reconciliations.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('accounting.errors.reconciliationsLoadFailed'));
        this.loading.set(false);
      },
    });
  }

  protected start(): void {
    const { cashAccountId, statementDate, endingBalance } = this.startForm.getRawValue();
    const iso = toIsoDate(statementDate);
    if (cashAccountId == null || !iso) {
      this.error.set(this.translate.instant('accounting.errors.pickAccountAndDate'));
      return;
    }
    this.run(this.gl.startBankReconciliation(DEFAULT_BOOK_ID, cashAccountId, iso, endingBalance ?? 0));
  }

  protected open(reconciliationId: number): void {
    this.run(this.gl.getBankReconciliation(reconciliationId));
  }

  /** Toggle a line's local (unsaved) cleared selection. Persists nothing until applyCleared(). */
  protected toggleLine(journalLineId: number): void {
    this.selectedLineIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(journalLineId)) next.delete(journalLineId);
      else next.add(journalLineId);
      return next;
    });
  }

  /** Commit every line whose local tick differs from the saved state, then refresh the recomputed worksheet. */
  protected applyCleared(): void {
    const ws = this.worksheet();
    if (!ws || ws.status !== 'Draft') return;
    const sel = this.selectedLineIds();
    const changes = ws.items
      .filter((i) => sel.has(i.journalLineId) !== i.isCleared)
      .map((i) => ({ journalLineId: i.journalLineId, cleared: sel.has(i.journalLineId) }));
    if (!changes.length) return;
    // No bulk endpoint today, so chain the per-line writes in order; the last response carries the
    // recomputed totals/difference.
    this.run(
      from(changes).pipe(
        concatMap((c) => this.gl.setBankReconciliationItemCleared(ws.reconciliationId, c.journalLineId, c.cleared)),
        last(),
      ),
    );
  }

  protected finalize(): void {
    const ws = this.worksheet();
    if (!ws) return;
    this.run(this.gl.finalizeBankReconciliation(ws.reconciliationId), { refreshList: true });
  }

  protected closeWorksheet(): void {
    this.worksheet.set(null);
    this.selectedLineIds.set(new Set());
  }

  private run(action: Observable<BankReconciliationWorksheet>, opts?: { refreshList?: boolean }): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ws) => {
        this.worksheet.set(ws);
        this.syncSelection(ws);
        this.busy.set(false);
        if (opts?.refreshList) this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const err = e as { error?: { message?: string; detail?: string } };
        this.error.set(err?.error?.message ?? err?.error?.detail ?? this.translate.instant('accounting.errors.actionFailed'));
      },
    });
  }

  /** Reset the local selection to mirror the worksheet's saved cleared flags (clears the dirty state). */
  private syncSelection(ws: BankReconciliationWorksheet): void {
    this.selectedLineIds.set(new Set(ws.items.filter((i) => i.isCleared).map((i) => i.journalLineId)));
  }
}
