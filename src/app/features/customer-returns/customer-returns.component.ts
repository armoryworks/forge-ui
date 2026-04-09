import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CustomerReturnService } from './services/customer-return.service';
import { CustomerReturnListItem } from './models/customer-return-list-item.model';
import { CustomerReturnDialogComponent } from './components/customer-return-dialog/customer-return-dialog.component';
import { CustomerReturnDetailDialogComponent, CustomerReturnDetailDialogData } from './components/customer-return-detail-dialog/customer-return-detail-dialog.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

@Component({
  selector: 'app-customer-returns',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective,
    CustomerReturnDialogComponent, LoadingBlockDirective,
    TranslatePipe, MatTooltipModule,
  ],
  templateUrl: './customer-returns.component.html',
  styleUrl: './customer-returns.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerReturnsComponent {
  private readonly service = inject(CustomerReturnService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly returns = signal<CustomerReturnListItem[]>([]);

  protected readonly showCreateDialog = signal(false);

  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('customerReturns.allStatuses') },
    { value: 'Received', label: 'Received' },
    { value: 'ReworkOrdered', label: 'Rework Ordered' },
    { value: 'InInspection', label: 'In Inspection' },
    { value: 'Resolved', label: 'Resolved' },
    { value: 'Closed', label: 'Closed' },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'returnNumber', header: this.translate.instant('customerReturns.returnNumber'), sortable: true, width: '150px' },
    { field: 'customerName', header: this.translate.instant('common.customer'), sortable: true },
    { field: 'originalJobNumber', header: this.translate.instant('customerReturns.originalJob'), sortable: true, width: '130px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '140px',
      filterOptions: [
        { value: 'Received', label: 'Received' },
        { value: 'ReworkOrdered', label: 'Rework Ordered' },
        { value: 'InInspection', label: 'In Inspection' },
        { value: 'Resolved', label: 'Resolved' },
        { value: 'Closed', label: 'Closed' },
      ]},
    { field: 'reason', header: this.translate.instant('customerReturns.reason'), sortable: true },
    { field: 'returnDate', header: this.translate.instant('customerReturns.returnDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.service.getReturns(undefined, status).subscribe({
      next: (list) => { this.returns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.load(); }

  protected openCustomerReturnDetail(row: unknown): void {
    const item = row as CustomerReturnListItem;
    openDetailDialog<CustomerReturnDetailDialogComponent, CustomerReturnDetailDialogData, boolean>(
      this.dialog,
      CustomerReturnDetailDialogComponent,
      { customerReturnId: item.id },
    ).afterClosed().subscribe(updated => {
      if (updated) {
        this.load();
      }
    });
  }

  protected openCreate(): void { this.showCreateDialog.set(true); }
  protected closeCreate(): void { this.showCreateDialog.set(false); }

  protected onCreated(): void {
    this.closeCreate();
    this.load();
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Received: 'chip--info',
      ReworkOrdered: 'chip--warning',
      InInspection: 'chip--primary',
      Resolved: 'chip--success',
      Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ReworkOrdered: 'Rework Ordered',
      InInspection: 'In Inspection',
    };
    return labels[status] ?? status;
  }
}
