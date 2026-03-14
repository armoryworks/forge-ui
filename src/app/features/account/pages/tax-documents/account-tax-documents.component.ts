import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { PayrollService } from '../../services/payroll.service';

@Component({
  selector: 'app-account-tax-documents',
  standalone: true,
  imports: [DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './account-tax-documents.component.html',
  styleUrl: './account-tax-documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountTaxDocumentsComponent implements OnInit {
  private readonly payrollService = inject(PayrollService);

  protected readonly taxDocuments = this.payrollService.taxDocuments;

  protected readonly columns: ColumnDef[] = [
    { field: 'taxYear', header: 'Tax Year', sortable: true, width: '100px' },
    { field: 'documentType', header: 'Document Type', sortable: true, width: '160px' },
    { field: 'employerName', header: 'Employer', sortable: true },
    { field: 'source', header: 'Source', sortable: true, width: '100px' },
    { field: 'actions', header: '', width: '60px' },
  ];

  ngOnInit(): void {
    this.payrollService.loadMyTaxDocuments();
  }

  protected getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      W2: 'W-2',
      W2c: 'W-2c (Corrected)',
      Misc1099: '1099-MISC',
      Nec1099: '1099-NEC',
      Other: 'Other',
    };
    return labels[type] ?? type;
  }

  protected downloadPdf(id: number): void {
    this.payrollService.downloadTaxDocumentPdf(id);
  }
}
