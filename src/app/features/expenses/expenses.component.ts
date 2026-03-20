import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { ExpensesService } from './services/expenses.service';
import { ExpenseItem } from './models/expense-item.model';
import { ExpenseStatus } from './models/expense-status.type';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { toIsoDate } from '../../shared/utils/date.utils';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective, LoadingBlockDirective,
    TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly expenses = signal<ExpenseItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<ExpenseStatus | ''>('');

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });
  private readonly statusFilter = toSignal(this.statusFilterControl.valueChanges.pipe(startWith('' as ExpenseStatus | '')), { initialValue: '' as ExpenseStatus | '' });

  // Dialog
  protected readonly showDialog = signal(false);
  protected readonly expenseForm = new FormGroup({
    amount: new FormControl<number>(0, [Validators.required, Validators.min(0.01)]),
    expenseDate: new FormControl<Date | null>(new Date(), [Validators.required]),
    category: new FormControl('', [Validators.required]),
    description: new FormControl(''),
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
    ]},
    { field: 'actions', header: this.translate.instant('expenses.colActions'), width: '80px', align: 'right' },
  ];

  protected readonly statuses: ExpenseStatus[] = ['Pending', 'Approved', 'Rejected', 'SelfApproved'];
  protected readonly categories = [
    'Materials', 'Tools', 'Travel', 'Fuel', 'Meals',
    'Shipping', 'Office Supplies', 'Equipment', 'Maintenance', 'Other',
  ];

  private readonly categoryKeyMap: Record<string, string> = {
    Materials: 'expenses.categoryMaterials',
    Tools: 'expenses.categoryTools',
    Travel: 'expenses.categoryTravel',
    Fuel: 'expenses.categoryFuel',
    Meals: 'expenses.categoryMeals',
    Shipping: 'expenses.categoryShipping',
    'Office Supplies': 'expenses.categoryOfficeSupplies',
    Equipment: 'expenses.categoryEquipment',
    Maintenance: 'expenses.categoryMaintenance',
    Other: 'expenses.categoryOther',
  };

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('expenses.allStatuses') },
    ...this.statuses.map(s => ({ value: s, label: s === 'SelfApproved' ? this.translate.instant('expenses.selfApproved') : this.translate.instant(`expenses.${s.toLowerCase()}`) })),
  ];

  protected readonly categoryOptions: SelectOption[] = this.categories.map(c => ({
    value: c,
    label: this.translate.instant(this.categoryKeyMap[c] ?? c),
  }));

  constructor() {
    this.loadExpenses();
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
    this.expenseForm.reset({
      amount: 0,
      expenseDate: new Date(),
      category: '',
      description: '',
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveExpense(): void {
    if (this.expenseForm.invalid) return;

    this.saving.set(true);
    const form = this.expenseForm.getRawValue();
    this.expensesService.createExpense({
      amount: form.amount!,
      category: form.category!,
      description: form.description ?? '',
      expenseDate: toIsoDate(form.expenseDate) ?? new Date().toISOString().split('T')[0],
    }).subscribe({
      next: () => { this.saving.set(false); this.closeDialog(); this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseSubmitted')); },
      error: () => this.saving.set(false),
    });
  }

  protected approveExpense(expense: ExpenseItem): void {
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Approved' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseApproved')); },
    });
  }

  protected rejectExpense(expense: ExpenseItem): void {
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Rejected' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success(this.translate.instant('expenses.expenseRejected')); },
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--warning', Approved: 'chip--success',
      Rejected: 'chip--error', SelfApproved: 'chip--success',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    if (status === 'SelfApproved') return this.translate.instant('expenses.selfApproved');
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
