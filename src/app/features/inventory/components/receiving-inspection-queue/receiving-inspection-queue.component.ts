import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { InventoryService } from '../../services/inventory.service';
import { PendingInspectionItem } from '../../models/pending-inspection.model';

@Component({
  selector: 'app-receiving-inspection-queue',
  standalone: true,
  imports: [DatePipe, DataTableComponent, ColumnCellDirective, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './receiving-inspection-queue.component.html',
  styleUrl: './receiving-inspection-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivingInspectionQueueComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);

  protected readonly items = signal<PendingInspectionItem[]>([]);
  protected readonly loading = signal(false);

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: 'Part #', sortable: true, width: '120px' },
    { field: 'partDescription', header: 'Description', sortable: true },
    { field: 'poNumber', header: 'PO #', sortable: true, width: '100px' },
    { field: 'vendorName', header: 'Vendor', sortable: true },
    { field: 'receivedQuantity', header: 'Qty', sortable: true, width: '80px', align: 'right' },
    { field: 'receivedAt', header: 'Received', sortable: true, type: 'date', width: '110px' },
    { field: 'daysWaiting', header: 'Days', sortable: true, width: '70px', align: 'right' },
  ];

  protected readonly rowClass = (row: unknown): string => {
    const item = row as PendingInspectionItem;
    if (item.daysWaiting > 7) return 'row--overdue-critical';
    if (item.daysWaiting > 3) return 'row--overdue-warning';
    return '';
  };

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.inventoryService.getPendingInspections().subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
