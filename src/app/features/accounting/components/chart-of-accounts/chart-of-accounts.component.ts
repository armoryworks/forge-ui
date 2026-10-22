import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { filter } from 'rxjs';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { GeneralLedgerService } from '../../services/general-ledger.service';
import { GlAccountAdmin } from '../../models/accounting.models';

const DEFAULT_BOOK_ID = 1;
const TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
const CASH_FLOW = ['Operating', 'Investing', 'Financing'];
const NOT_BLANK = /\S/;
const ACCOUNT_NUMBER = /^\s*[A-Za-z0-9][A-Za-z0-9.-]*\s*$/;

const conventionalBalance = (type: string | null): 'Debit' | 'Credit' =>
  type === 'Asset' || type === 'Expense' ? 'Debit' : 'Credit';

/** Chart-of-accounts management: create postable accounts + edit safe fields. Structural fields
 * (number/type/normal-balance) lock once an account has postings — the editor disables them. The
 * normal balance defaults to the type's convention; the opposite side marks a contra account. */
@Component({
  selector: 'app-chart-of-accounts',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, PageLayoutComponent, DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
  ],
  templateUrl: './chart-of-accounts.component.html',
  styleUrl: './chart-of-accounts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartOfAccountsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(FormBuilder);
  private readonly gl = inject(GeneralLedgerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  private bookId = DEFAULT_BOOK_ID;

  protected readonly accounts = signal<GlAccountAdmin[]>([]);
  protected readonly loading = signal(false);
  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<GlAccountAdmin | null>(null);
  protected readonly saving = signal(false);

  /** Structural fields lock when editing an account that already has postings. */
  protected readonly structuralLocked = computed(() => this.editing()?.hasPostings ?? false);

  protected readonly typeOptions: SelectOption[] = TYPES.map(t => ({ value: t, label: t }));
  protected readonly balanceOptions: SelectOption[] = [
    { value: 'Debit', label: 'Debit' }, { value: 'Credit', label: 'Credit' },
  ];
  protected readonly cashFlowOptions: SelectOption[] = [
    { value: null, label: '— None —' }, ...CASH_FLOW.map(c => ({ value: c, label: c })),
  ];
  protected readonly parentOptions = computed<SelectOption[]>(() => [
    { value: null, label: '— None —' },
    ...this.accounts().map(a => ({ value: a.id, label: `${a.accountNumber} — ${a.name}` })),
  ]);

  protected readonly columns: ColumnDef[] = [
    { field: 'accountNumber', header: 'columns.number', sortable: true, width: '110px' },
    { field: 'name', header: 'common.name', sortable: true },
    { field: 'accountType', header: 'common.type', sortable: true, filterable: true, type: 'enum',
      filterOptions: TYPES.map(t => ({ value: t, label: t })) },
    { field: 'normalBalance', header: 'columns.normalBalance', sortable: true, width: '90px' },
    { field: 'isPostable', header: 'columns.postable', align: 'center', width: '90px' },
    { field: 'isActive', header: 'common.active', align: 'center', width: '80px' },
    { field: 'actions', header: '', align: 'right', width: '90px' },
  ];

  protected readonly form = this.fb.group({
    accountNumber: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(ACCOUNT_NUMBER)]],
    name: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(NOT_BLANK)]],
    accountType: ['Expense', Validators.required],
    normalBalance: ['Debit', Validators.required],
    parentAccountId: this.fb.control<number | null>(null),
    cashFlowCategory: this.fb.control<string | null>(null),
    requiresJob: [false],
    requiresCostCenter: [false],
    isActive: [true],
    description: this.fb.control<string | null>(null),
  });

  private readonly typeValue = toSignal(this.form.controls.accountType.valueChanges, { initialValue: this.form.controls.accountType.value });
  private readonly balanceValue = toSignal(this.form.controls.normalBalance.valueChanges, { initialValue: this.form.controls.normalBalance.value });
  /** The chosen normal balance is opposite the type's convention (a contra account). */
  protected readonly contraBalance = computed(() => {
    const type = this.typeValue();
    const balance = this.balanceValue();
    return !!type && !!balance && conventionalBalance(type) !== balance;
  });

  constructor() {
    this.form.controls.accountType.valueChanges
      .pipe(
        filter(() => this.form.controls.accountType.dirty),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onTypeChange());
  }

  ngOnInit(): void {
    const b = Number(this.route.snapshot.queryParamMap.get('bookId'));
    this.bookId = b > 0 ? b : DEFAULT_BOOK_ID;
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.gl.listGlAccountsForManagement(this.bookId).subscribe({
      next: r => { this.accounts.set(r); this.loading.set(false); },
      error: (err: unknown) => { this.snackbar.errorFrom(err, 'errorFallbacksA.chartOfAccountsLoadFailed'); this.loading.set(false); },
    });
  }

  /** Default the normal balance to the type convention when the user picks a type; it can still be flipped for a contra account. */
  protected onTypeChange(): void {
    this.form.controls.normalBalance.setValue(conventionalBalance(this.form.controls.accountType.value));
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ accountNumber: '', name: '', accountType: 'Expense', normalBalance: 'Debit', isActive: true, requiresJob: false, requiresCostCenter: false, parentAccountId: null, cashFlowCategory: null, description: null });
    this.dialogOpen.set(true);
  }

  protected openEdit(a: GlAccountAdmin): void {
    if (a.isControlAccount) { this.snackbar.error(this.translate.instant('accounting.coa.controlSystemManaged')); return; }
    this.editing.set(a);
    this.form.reset({
      accountNumber: a.accountNumber, name: a.name, accountType: a.accountType, normalBalance: a.normalBalance,
      parentAccountId: a.parentAccountId, cashFlowCategory: a.cashFlowCategory, requiresJob: a.requiresJob,
      requiresCostCenter: a.requiresCostCenter, isActive: a.isActive, description: a.description,
    });
    this.dialogOpen.set(true);
  }

  protected close(): void { this.dialogOpen.set(false); }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    const done = {
      next: () => { this.snackbar.success(this.translate.instant('accounting.coa.saved')); this.saving.set(false); this.dialogOpen.set(false); this.load(); },
      error: (e: unknown) => { this.snackbar.errorFrom(e, 'errorFallbacksA.glAccountSaveFailed'); this.saving.set(false); },
    };
    const current = this.editing();
    if (current) {
      const locked = current.hasPostings;
      this.gl.updateGlAccount({
        id: current.id, name: v.name!.trim(), parentAccountId: v.parentAccountId, requiresJob: v.requiresJob!,
        requiresCostCenter: v.requiresCostCenter!, cashFlowCategory: v.cashFlowCategory, description: v.description,
        isActive: v.isActive!,
        accountNumber: locked ? null : v.accountNumber!.trim(), accountType: locked ? null : v.accountType!, normalBalance: locked ? null : v.normalBalance!,
      }).subscribe(done);
    } else {
      this.gl.createGlAccount({
        bookId: this.bookId, accountNumber: v.accountNumber!.trim(), name: v.name!.trim(), accountType: v.accountType!,
        normalBalance: v.normalBalance!, parentAccountId: v.parentAccountId, requiresJob: v.requiresJob!,
        requiresCostCenter: v.requiresCostCenter!, cashFlowCategory: v.cashFlowCategory, description: v.description,
      }).subscribe(done);
    }
  }
}
