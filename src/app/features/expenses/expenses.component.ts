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
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, DialogComponent,
    InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, ValidationPopoverDirective,
  ],
  templateUrl: './expenses.component.html',
  styleUrl: './expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpensesComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

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
    { field: 'expenseDate', header: 'Date', sortable: true, type: 'date' },
    { field: 'category', header: 'Category', sortable: true },
    { field: 'description', header: 'Description' },
    { field: 'jobNumber', header: 'Job' },
    { field: 'userName', header: 'Submitted By', sortable: true },
    { field: 'amount', header: 'Amount', sortable: true, align: 'right' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', filterOptions: [
      { value: 'Pending', label: 'Pending' }, { value: 'Approved', label: 'Approved' },
      { value: 'Rejected', label: 'Rejected' }, { value: 'SelfApproved', label: 'Self-Approved' },
    ]},
    { field: 'actions', header: 'Actions', width: '80px', align: 'right' },
  ];

  protected readonly statuses: ExpenseStatus[] = ['Pending', 'Approved', 'Rejected', 'SelfApproved'];
  protected readonly categories = [
    'Materials', 'Tools', 'Travel', 'Fuel', 'Meals',
    'Shipping', 'Office Supplies', 'Equipment', 'Maintenance', 'Other',
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: '', label: 'All Statuses' },
    ...this.statuses.map(s => ({ value: s, label: s === 'SelfApproved' ? 'Self-Approved' : s })),
  ];

  protected readonly categoryOptions: SelectOption[] = this.categories.map(c => ({ value: c, label: c }));

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
      next: () => { this.saving.set(false); this.closeDialog(); this.loadExpenses(); this.snackbar.success('Expense submitted.'); },
      error: () => this.saving.set(false),
    });
  }

  protected approveExpense(expense: ExpenseItem): void {
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Approved' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success('Expense approved.'); },
    });
  }

  protected rejectExpense(expense: ExpenseItem): void {
    this.expensesService.updateExpenseStatus(expense.id, { status: 'Rejected' }).subscribe({
      next: () => { this.loadExpenses(); this.snackbar.success('Expense rejected.'); },
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
    return status === 'SelfApproved' ? 'Self-Approved' : status;
  }

  protected getTotalAmount(): number {
    return this.expenses().reduce((sum, e) => sum + e.amount, 0);
  }

  protected deleteExpense(expense: ExpenseItem): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Expense?',
        message: 'This will permanently delete this expense record.',
        confirmLabel: 'Delete',
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.expensesService.deleteExpense(expense.id).subscribe({
        next: () => {
          this.loadExpenses();
          this.snackbar.success('Expense deleted.');
        },
      });
    });
  }
}
