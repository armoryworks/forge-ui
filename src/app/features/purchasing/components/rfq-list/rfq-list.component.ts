import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { RfqListItem } from '../../models/rfq.model';

@Component({
  selector: 'app-rfq-list',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective, LoadingBlockDirective],
  templateUrl: './rfq-list.component.html',
  styleUrl: './rfq-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RfqListComponent {
  readonly data = input.required<RfqListItem[]>();
  readonly loading = input(false);
  readonly rowClicked = output<RfqListItem>();

  protected readonly rfqColumns: ColumnDef[] = [
    { field: 'rfqNumber', header: 'RFQ #', sortable: true, width: '140px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '120px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'quantity', header: 'Qty', sortable: true, width: '80px', align: 'center' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '150px',
      filterOptions: [
        { value: 'Draft', label: 'Draft' },
        { value: 'Sent', label: 'Sent' },
        { value: 'Receiving', label: 'Receiving' },
        { value: 'EvaluatingResponses', label: 'Evaluating' },
        { value: 'Awarded', label: 'Awarded' },
        { value: 'Cancelled', label: 'Cancelled' },
        { value: 'Expired', label: 'Expired' },
      ] },
    { field: 'vendorResponseCount', header: 'Vendors', sortable: true, width: '90px', align: 'center' },
    { field: 'receivedResponseCount', header: 'Received', sortable: true, width: '90px', align: 'center' },
    { field: 'requiredDate', header: 'Required', sortable: true, type: 'date', width: '110px' },
    { field: 'responseDeadline', header: 'Deadline', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
  ];

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Sent: 'chip--info',
      Receiving: 'chip--primary',
      EvaluatingResponses: 'chip--warning',
      Awarded: 'chip--success',
      Cancelled: 'chip--error',
      Expired: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      EvaluatingResponses: 'Evaluating',
    };
    return map[status] ?? status;
  }

  protected onRowClick(row: unknown): void {
    this.rowClicked.emit(row as RfqListItem);
  }
}
