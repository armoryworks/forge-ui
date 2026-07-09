import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal, ViewChild } from '@angular/core';

import { Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ExpenseSettings } from './models/expense-settings.model';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { ExpensesService } from './services/expenses.service';
import { ApprovalsService } from '../approvals/services/approvals.service';
import { ExpenseItem } from './models/expense-item.model';
import { ExpenseStatus } from './models/expense-status.type';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { DraftConfig } from '../../shared/models/draft-config.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { toIsoDate, todayEnd } from '../../shared/utils/date.utils';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ReferenceDataService } from '../../shared/services/reference-data.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { EntityLinkComponent } from '../../shared/components/entity-link/entity-link.component';
import { VendorService } from '../vendors/services/vendor.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, CurrencyInputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, ValidationButtonComponent, LoadingBlockDirective,
    TranslatePipe, MatTooltipModule, EntityLinkComponent,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesComponent implements OnInit {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly expensesService = inject(ExpensesService);
  private readonly approvalsService = inject(ApprovalsService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly vendorService = inject(VendorService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftResume = inject(DraftResumeService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly expenses = signal<ExpenseItem[]>([]);
  /** Phase 1l — expense dates can't be in the future. */
  protected readonly today = todayEnd();
  protected draftConfig: DraftConfig = { entityType: 'expense', entityId: 'new', route: '/expenses' };

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<ExpenseStatus | ''>('');

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith('' as ExpenseStatus | '')), { initialValue: '' as ExpenseStatus | '' });

  // Dialog
  protected readonly showDialog = signal(false);
  protected readonly editingExpense = signal<ExpenseItem | null>(null);
  protected readonly settings = signal<ExpenseSettings | null>(null);
  protected readonly receiptFileId = signal<string | null>(null);
  protected readonly receiptFileName = signal<string | null>(null);
  protected readonly uploadingReceipt = signal(false);
  protected readonly expenseForm = new FormGroup({
    amount: new FormControl<number>(0, [Validators.required, Validators.min(0.01)]),
    expenseDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    category: new FormControl('', [Validators.required]),
    description: new FormControl(''),
    // Vendor-settled: naming a vendor routes the expense to AP — approval promotes it into a
    // vendor bill paid through Payables. Null = out-of-pocket (cash).
    vendorId: new FormControl<number | null>(null),
  });

  protected readonly receiptMissing = computed(() => {
    const s = this.settings();
    return !!s?.requireReceipt && !this.receiptFileId();
  });

  protected readonly expenseViolations = FormValidationService.getViolations(this.expenseForm, {
    amount: 'Amount',
    expenseDate: 'Date',
    category: 'Category',
    description: 'Description',
  });

  protected readonly expenseColumns: ColumnDef[] = [
    { field: 'expenseDate', header: this.translate.instant('expenses.colDate'), sortable: true, type: 'date' },
    { field: 'category', header: this.translate.instant('expenses.colCategory'), sortable: true },
    { field: 'description', header: this.translate.instant('expenses.colDescription') },
    { field: 'jobNumber', header: this.translate.instant('expenses.colJob') },
    { field: 'userName', header: this.translate.instant('expenses.colSubmittedBy'), sortable: true },
    { field: 'amount', header: this.translate.instant('expenses.colAmount'), sortable: true, align: 'right' },
    { field: 'status', header: this.translate.instant('expenses.colStatus'), sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Pending', label: this.translate.instant('common.pending') }, { value: 'Approved', label: this.translate.instant('expenses.approved') },
      { value: 'Rejected', label: this.translate.instant('expenses.rejected') }, { value: 'SelfApproved', label: this.translate.instant('expenses.selfApproved') },
      { value: 'NeedsRevision', label: this.translate.instant('expenses.needsRevision') }, { value: 'Reimbursed', label: this.translate.instant('expenses.reimbursed') },
    ]},
    { field: 'actions', header: this.translate.instant('expenses.colActions'), width: '80px', align: 'right' },
  ];

  protected readonly statuses: ExpenseStatus[] = ['Pending', 'Approved', 'Rejected', 'SelfApproved', 'NeedsRevision', 'Reimbursed'];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('expenses.allStatuses') },
    ...this.statuses.map(s => ({
      value: s,
      label: s === 'SelfApproved' ? this.translate.instant('expenses.selfApproved')
        : s === 'NeedsRevision' ? this.translate.instant('expenses.needsRevision')
        : this.translate.instant(`expenses.${s.toLowerCase()}`),
    })),
  ];

  protected readonly categoryOptions = signal<SelectOption[]>([]);

  protected readonly vendorOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('expenses.noVendor') },
  ]);

  constructor() {
    this.refDataService.getAsOptions('expense_category', { valueField: 'label' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(opts => this.categoryOptions.set(opts));
    this.vendorService.getVendorDropdown().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (vendors) => this.vendorOptions.set([
        { value: null, label: this.translate.instant('expenses.noVendor') },
        ...vendors.map(v => ({ value: v.id, label: v.companyName })),
      ]),
    });
    this.expensesService.getSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => this.settings.set(s),
      error: () => this.settings.set(null),
    });
    this.loadExpenses();
  }

  ngOnInit(): void {
    if (this.draftResume.consume('expense')) {
      this.openCreateExpense();
    }
  }

  private applyPolicyValidators(): void {
    const s = this.settings();
    const amountValidators: ValidatorFn[] = [Validators.required, Validators.min(0.01)];
    if (s?.maxAmount && s.maxAmount > 0) amountValidators.push(Validators.max(s.maxAmount));
    this.expenseForm.controls.amount.setValidators(amountValidators);
    this.expenseForm.controls.amount.updateValueAndValidity({ emitEvent: false });

    const descValidators: ValidatorFn[] = [];
    if (s && s.minDescriptionLength > 0) {
      descValidators.push(Validators.required, Validators.minLength(s.minDescriptionLength));
    }
    this.expenseForm.controls.description.setValidators(descValidators);
    this.expenseForm.controls.description.updateValueAndValidity({ emitEvent: false });
  }

  protected loadExpenses(): void {
    this.loading.set(true);
    const status = (this.statusFilter() ?? '') || undefined;
    const search = (this.searchTerm() ?? '').trim() || undefined;
    this.expensesService.getExpenses(undefined, status, search).subscribe({
      next: (expenses) => { this.expenses.set(expenses); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadExpenses(); }
  protected clearSearch(): void { this.searchControl.setValue(''); this.loadExpenses(); }

  protected openCreateExpense(): void {
    this.editingExpense.set(null);
    this.receiptFileId.set(null);
    this.receiptFileName.set(null);
    this.applyPolicyValidators();
    this.expenseForm.reset({
      amount: 0,
      expenseDate: new Date(),
      category: '',
      description: '',
      vendorId: null,
    });
    this.showDialog.set(true);
  }

  protected openEditExpense(expense: ExpenseItem): void {
    this.editingExpense.set(expense);
    this.receiptFileId.set(expense.receiptFileId ?? null);
    this.receiptFileName.set(expense.receiptFileId ? this.translate.instant('expenses.existingReceipt') : null);
    this.applyPolicyValidators();
    this.expenseForm.reset({
      amount: expense.amount,
      expenseDate: new Date(expense.expenseDate),
      category: expense.category,
      description: expense.description ?? '',
      vendorId: expense.vendorId,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingExpense.set(null);
    this.receiptFileId.set(null);
    this.receiptFileName.set(null);
  }

  protected onReceiptFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingReceipt.set(true);
    this.expensesService.uploadReceipt(file).subscribe({
      next: (attachment) => {
        this.receiptFileId.set(attachment.id);
        this.receiptFileName.set(attachment.fileName);
        this.uploadingReceipt.set(false);
        input.value = '';
      },
      error: () => {
        this.uploadingReceipt.set(false);
        input.value = '';
      },
    });
  }

  protected removeReceipt(): void {
    this.receiptFileId.set(null);
    this.receiptFileName.set(null);
  }

  protected saveExpense(): void {
    if (this.expenseForm.invalid || this.receiptMissing()) return;

    this.saving.set(true);
    const form = this.expenseForm.getRawValue();
    const payload = {
      amount: form.amount!,
      category: form.category!,
      description: form.description ?? '',
      expenseDate: toIsoDate(form.expenseDate) ?? new Date().toISOString().split('T')[0],
      receiptFileId: this.receiptFileId() ?? undefined,
      vendorId: form.vendorId ?? undefined,
    };

    const editing = this.editingExpense();
    const request$ = editing
      ? this.expensesService.updateExpense(editing.id, payload)
      : this.expensesService.createExpense(payload);
    const successKey = editing?.status === 'NeedsRevision'
      ? 'expenses.expenseResubmitted'
      : 'expenses.expenseSubmitted';

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
        this.closeDialog();
        this.loadExpenses();
        this.snackbar.success(this.translate.instant(successKey));
      },
      error: () => this.saving.set(false),
    });
  }

  protected approveExpense(expense: ExpenseItem): void {
    // Governed expense: route the decision through the approval engine (the guarded PATCH
    // would 409). Completing the workflow flips the status server-side, so just refresh.
    if (expense.pendingApprovalRequestId != null) {
      this.approvalsService.approve(expense.pendingApprovalRequestId).subscribe({
        next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseApproved')); },
      });
      return;
    }
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Approved' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseApproved')); },
    });
  }

  protected rejectExpense(expense: ExpenseItem): void {
    // Governed expense: the approval engine reject requires a comment, which this inline row
    // action doesn't collect — send the reviewer to the approval queue to reject with a note.
    if (expense.pendingApprovalRequestId != null) {
      this.snackbar.info(this.translate.instant('expenses.rejectInQueueHint'));
      this.router.navigate(['/expenses/approval']);
      return;
    }
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Rejected' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseRejected')); },
    });
  }

  // F-EXP-03: reimbursement is the terminal state once an approved expense has been paid back.
  // Server gates the action to approver roles (Admin/Manager/OfficeManager) + Approved/SelfApproved.
  protected reimburseExpense(expense: ExpenseItem): void {
    this.expensesService.reimburseExpense(expense.id).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseReimbursed')); },
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--warning', Approved: 'chip--success',
      Rejected: 'chip--error', SelfApproved: 'chip--success',
      NeedsRevision: 'chip--warning', Reimbursed: 'chip--info',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    if (status === 'SelfApproved') return this.translate.instant('expenses.selfApproved');
    if (status === 'NeedsRevision') return this.translate.instant('expenses.needsRevision');
    const key = `expenses.${status.toLowerCase()}`;
    return this.translate.instant(key);
  }

  protected getTotalAmount(): number {
    return this.expenses().reduce((sum, e) => sum + e.amount, 0);
  }

  protected deleteExpense(expense: ExpenseItem): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('expenses.deleteTitle'),
        message: this.translate.instant('expenses.deleteMessage'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.expensesService.deleteExpense(expense.id).subscribe({
        next: () => {
          this.loadExpenses();
          this.snackbar.success(this.translate.instant('expenses.expenseDeleted'));
        },
      });
    });
  }
}
