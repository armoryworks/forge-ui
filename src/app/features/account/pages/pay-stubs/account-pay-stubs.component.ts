import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { PayrollService } from '../../services/payroll.service';

@Component({
  selector: 'app-account-pay-stubs',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, TranslatePipe, MatTooltipModule, DataTableComponent, ColumnCellDirective],
  templateUrl: './account-pay-stubs.component.html',
  styleUrl: './account-pay-stubs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPayStubsComponent implements OnInit {
  private readonly payrollService = inject(PayrollService);
  private readonly translate = inject(TranslateService);

  protected readonly payStubs = this.payrollService.payStubs;

  protected readonly columns: ColumnDef[] = [
    { field: 'payDate', header: this.translate.instant('account.colPayDate'), sortable: true, type: 'date', width: '120px' },
    { field: 'period', header: this.translate.instant('account.colPeriod'), sortable: false, width: '200px' },
    { field: 'grossPay', header: this.translate.instant('account.colGrossPay'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'netPay', header: this.translate.instant('account.colNetPay'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'totalDeductions', header: this.translate.instant('account.colDeductions'), sortable: true, type: 'number', width: '120px', align: 'right' },
    { field: 'source', header: this.translate.instant('account.colSource'), sortable: true, width: '100px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  ngOnInit(): void {
    this.payrollService.loadMyPayStubs();
  }

  protected downloadPdf(id: number): void {
    this.payrollService.downloadPayStubPdf(id);
  }
}
