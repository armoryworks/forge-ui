import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { PayrollService } from '../../services/payroll.service';

@Component({
  selector: 'app-account-pay-stubs',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './account-pay-stubs.component.html',
  styleUrl: './account-pay-stubs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPayStubsComponent implements OnInit {
  private readonly payrollService = inject(PayrollService);

  protected readonly payStubs = this.payrollService.payStubs;

  protected readonly columns: ColumnDef[] = [
    { field: 'payDate', header: 'Pay Date', sortable: true, type: 'date', width: '120px' },
    { field: 'period', header: 'Period', sortable: false, width: '200px' },
    { field: 'grossPay', header: 'Gross Pay', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'netPay', header: 'Net Pay', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'totalDeductions', header: 'Deductions', sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'source', header: 'Source', sortable: true, width: '100px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  ngOnInit(): void {
    this.payrollService.loadMyPayStubs();
  }

  protected downloadPdf(id: number): void {
    this.payrollService.downloadPayStubPdf(id);
  }
}
