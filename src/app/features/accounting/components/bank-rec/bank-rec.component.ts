import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly cashAccounts = signal<CashAccountModel[]>([]);
  protected readonly reconciliations = signal<BankReconciliationSummary[]>([]);
  protected readonly worksheet = signal<BankReconciliationWorksheet | null>(null);

  // Start-new form (reactive — no ngModel).
  protected readonly startForm = new FormGroup({
    cashAccountId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    statementDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    endingBalance: new FormControl<number | null>(0),
  });

  protected readonly startViolations = FormValidationService.getViolations(this.startForm, {
    cashAccountId: 'Cash account',
    statementDate: 'Statement date',
  });

  protected readonly cashAccountOptions = computed<SelectOption[]>(() =>
    this.cashAccounts().map((a) => ({ value: a.glAccountId, label: `${a.accountNumber} · ${a.name}` })));

  protected readonly reconColumns: ColumnDef[] = [
    { field: 'cashAccountName', header: 'Account', sortable: true },
    { field: 'statementDate', header: 'Statement date', sortable: true, type: 'date', width: '150px' },
    { field: 'statementEndingBalance', header: 'Ending balance', sortable: true, type: 'number', align: 'right', width: '150px' },
    { field: 'status', header: 'Status', sortable: true, width: '120px' },
    { field: 'difference', header: 'Difference', sortable: true, type: 'number', align: 'right', width: '140px' },
  ];

  protected readonly itemColumns: ColumnDef[] = [
    { field: 'isCleared', header: 'Cleared', align: 'center', width: '90px' },
    { field: 'entryDate', header: 'Date', sortable: true, type: 'date', width: '130px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'amount', header: 'Amount', sortable: true, type: 'number', align: 'right', width: '140px' },
  ];

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
      error: () => this.error.set('Could not load cash accounts.'),
    });
    this.gl.getBankReconciliations(DEFAULT_BOOK_ID).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.reconciliations.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load reconciliations.');
        this.loading.set(false);
      },
    });
  }

  protected start(): void {
    const { cashAccountId, statementDate, endingBalance } = this.startForm.getRawValue();
    const iso = toIsoDate(statementDate);
    if (cashAccountId == null || !iso) {
      this.error.set('Pick a cash account and statement date.');
      return;
    }
    this.run(this.gl.startBankReconciliation(DEFAULT_BOOK_ID, cashAccountId, iso, endingBalance ?? 0));
  }

  protected open(reconciliationId: number): void {
    this.run(this.gl.getBankReconciliation(reconciliationId));
  }

  protected toggle(journalLineId: number, cleared: boolean): void {
    const ws = this.worksheet();
    if (!ws || ws.status !== 'Draft') return;
    this.run(this.gl.setBankReconciliationItemCleared(ws.reconciliationId, journalLineId, cleared));
  }

  protected finalize(): void {
    const ws = this.worksheet();
    if (!ws) return;
    this.run(this.gl.finalizeBankReconciliation(ws.reconciliationId), { refreshList: true });
  }

  protected closeWorksheet(): void {
    this.worksheet.set(null);
  }

  private run(action: Observable<BankReconciliationWorksheet>, opts?: { refreshList?: boolean }): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (ws) => {
        this.worksheet.set(ws);
        this.busy.set(false);
        if (opts?.refreshList) this.load();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const err = e as { error?: { message?: string; detail?: string } };
        this.error.set(err?.error?.message ?? err?.error?.detail ?? 'The action could not be completed.');
      },
    });
  }
}
