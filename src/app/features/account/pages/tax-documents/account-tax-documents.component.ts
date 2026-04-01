import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { PayrollService } from '../../services/payroll.service';

@Component({
  selector: 'app-account-tax-documents',
  standalone: true,
  imports: [TranslatePipe, MatTooltipModule, DataTableComponent, ColumnCellDirective],
  templateUrl: './account-tax-documents.component.html',
  styleUrl: './account-tax-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxDocumentsComponent implements OnInit {
  private readonly payrollService = inject(PayrollService);
  private readonly translate = inject(TranslateService);

  protected readonly taxDocuments = this.payrollService.taxDocuments;

  protected readonly columns: ColumnDef[] = [
    { field: 'taxYear', header: this.translate.instant('account.colTaxYear'), sortable: true, width: '100px' },
    { field: 'documentType', header: this.translate.instant('account.colDocumentType'), sortable: true, width: '160px' },
    { field: 'employerName', header: this.translate.instant('account.colEmployer'), sortable: true },
    { field: 'source', header: this.translate.instant('account.colSource'), sortable: true, width: '100px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  ngOnInit(): void {
    this.payrollService.loadMyTaxDocuments();
  }

  protected getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      W2: this.translate.instant('account.w2'),
      W2c: this.translate.instant('account.w2c'),
      Misc1099: this.translate.instant('account.misc1099'),
      Nec1099: this.translate.instant('account.nec1099'),
      Other: this.translate.instant('account.other'),
    };
    return labels[type] ?? type;
  }

  protected downloadPdf(id: number): void {
    this.payrollService.downloadTaxDocumentPdf(id);
  }
}
