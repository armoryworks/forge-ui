import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';

import { ExpensesService } from '../services/expenses.service';
import { ExpenseItem } from '../models/expense-item.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { InputComponent } from '../../../shared/components/input/input.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';

@Component({
  selector: 'app-expense-approval-queue',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageLayoutComponent, DataTableComponent, ColumnCellDirective,
    InputComponent, AvatarComponent, TextareaComponent, DialogComponent,
    LoadingBlockDirective, SpacerDirective,
  ],
  templateUrl: './expense-approval-queue.component.html',
  styleUrl: './expense-approval-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpenseApprovalQueueComponent {
  private readonly expensesService = inject(ExpensesService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = signal(false);
  protected readonly pendingExpenses = signal<ExpenseItem[]>([]);
  protected readonly searchControl = new FormControl('');

  // Review dialog
  protected readonly reviewExpense = signal<ExpenseItem | null>(null);
  protected readonly notesControl = new FormControl('');
  protected readonly processing = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'expenseDate', header: 'Date', sortable: true, type: 'date', width: '110px' },
    { field: 'userName', header: 'Submitted By', sortable: true, width: '160px' },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'description', header: 'Description' },
    { field: 'jobNumber', header: 'Job', width: '100px' },
    { field: 'amount', header: 'Amount', sortable: true, align: 'right', width: '100px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  constructor() {
    this.loadPending();
  }

  protected loadPending(): void {
    this.loading.set(true);
    const search = this.searchControl.value?.trim() || undefined;
    this.expensesService.getExpenses(undefined, 'Pending', search).subscribe({
      next: (items) => { this.pendingExpenses.set(items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openReview(expense: ExpenseItem): void {
    this.reviewExpense.set(expense);
    this.notesControl.setValue('');
  }

  protected closeReview(): void {
    this.reviewExpense.set(null);
  }

  protected approve(): void {
    const expense = this.reviewExpense();
    if (!expense) return;

    this.processing.set(true);
    this.expensesService.updateExpenseStatus(expense.id, {
      status: 'Approved',
      approvalNotes: this.notesControl.value?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.processing.set(false);
        this.closeReview();
        this.loadPending();
        this.snackbar.success('Expense approved.');
      },
      error: () => this.processing.set(false),
    });
  }

  protected reject(): void {
    const expense = this.reviewExpense();
    if (!expense) return;

    this.processing.set(true);
    this.expensesService.updateExpenseStatus(expense.id, {
      status: 'Rejected',
      approvalNotes: this.notesControl.value?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.processing.set(false);
        this.closeReview();
        this.loadPending();
        this.snackbar.success('Expense rejected.');
      },
      error: () => this.processing.set(false),
    });
  }

  protected getPendingTotal(): number {
    return this.pendingExpenses().reduce((sum, e) => sum + e.amount, 0);
  }
}
