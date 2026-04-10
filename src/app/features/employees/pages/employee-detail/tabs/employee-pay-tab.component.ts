import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';

import { EmployeeService } from '../../../services/employee.service';
import { EmployeePayStub } from '../../../models/employee.model';
import { DataTableComponent } from '../../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../../shared/models/column-def.model';

@Component({
  selector: 'app-employee-pay-tab',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DataTableComponent, ColumnCellDirective],
  templateUrl: './employee-pay-tab.component.html',
  styleUrl: '../employee-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeePayTabComponent implements OnInit {
  private readonly employeeService = inject(EmployeeService);

  readonly employeeId = input.required<number>();

  protected readonly stubs = signal<EmployeePayStub[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'payDate', header: 'Pay Date', sortable: true, type: 'date', width: '100px' },
    { field: 'payPeriodStart', header: 'Period Start', sortable: true, type: 'date', width: '100px' },
    { field: 'payPeriodEnd', header: 'Period End', sortable: true, type: 'date', width: '100px' },
    { field: 'grossPay', header: 'Gross', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalDeductions', header: 'Deductions', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'totalTaxes', header: 'Taxes', sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'netPay', header: 'Net Pay', sortable: true, type: 'number', width: '100px', align: 'right' },
  ];

  ngOnInit(): void {
    this.loading.set(true);
    this.employeeService.getPaySummary(this.employeeId()).subscribe({
      next: data => { this.stubs.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
