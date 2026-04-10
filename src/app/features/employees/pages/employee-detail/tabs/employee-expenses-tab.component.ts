import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeeExpense } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-expenses-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-expenses-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeExpensesTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();

  protected readonly expenses = signal<EmployeeExpense[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'expenseDate', header: 'Date', sortable: true, type: 'date', width: '100px' },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'amount', header: 'Amount', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'status', header: 'Status', sortable: true, width: '100px' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getExpenses(this.employeeId()).subscribe({
      next: data => { this.expenses.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--warning',
      Approved: 'chip--success',
      Rejected: 'chip--error',
      Reimbursed: 'chip--info',
    };
    return map[status] ?? 'chip--muted';
  }
}
