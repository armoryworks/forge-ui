import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ShipmentService } from './services/shipment.service';
import { ShipmentListItem } from './models/shipment-list-item.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { ShipmentDialogComponent } from './components/shipment-dialog/shipment-dialog.component';
import { ShipmentDetailDialogComponent, ShipmentDetailDialogData } from './components/shipment-detail-dialog/shipment-detail-dialog.component';
import { openDetailDialog } from '../../shared/utils/detail-dialog.utils';

@Component({
  selector: 'app-shipments',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    ShipmentDialogComponent, TranslatePipe,
  ],
  templateUrl: './shipments.component.html',
  styleUrl: './shipments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentsComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly showCreateDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly shipments = signal<ShipmentListItem[]>([]);

  // Filters
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilterControl = new FormControl<string | null>(null);

  private readonly searchTerm = toSignal(this.searchControl.valueChanges.pipe(startWith('')), { initialValue: '' });

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('shipments.allStatuses') },
    { value: 'Pending', label: this.translate.instant('shipments.statusPending') },
    { value: 'Packed', label: this.translate.instant('shipments.statusPacked') },
    { value: 'Shipped', label: this.translate.instant('shipments.statusShipped') },
    { value: 'InTransit', label: this.translate.instant('shipments.statusInTransit') },
    { value: 'Delivered', label: this.translate.instant('shipments.statusDelivered') },
    { value: 'Cancelled', label: this.translate.instant('shipments.statusCancelled') },
  ];

  protected readonly shipmentColumns: ColumnDef[] = [
    { field: 'shipmentNumber', header: this.translate.instant('shipments.shipmentNumber'), sortable: true, width: '120px' },
    { field: 'salesOrderNumber', header: this.translate.instant('shipments.soNumber'), sortable: true, width: '120px' },
    { field: 'customerName', header: this.translate.instant('shipments.customer'), sortable: true },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, filterable: true, type: 'enum', width: '120px', filterOptions: [
      { value: 'Pending', label: this.translate.instant('shipments.statusPending') },
      { value: 'Packed', label: this.translate.instant('shipments.statusPacked') },
      { value: 'Shipped', label: this.translate.instant('shipments.statusShipped') },
      { value: 'InTransit', label: this.translate.instant('shipments.statusInTransit') },
      { value: 'Delivered', label: this.translate.instant('shipments.statusDelivered') },
      { value: 'Cancelled', label: this.translate.instant('shipments.statusCancelled') },
    ]},
    { field: 'carrier', header: this.translate.instant('shipments.carrier'), sortable: true, width: '100px' },
    { field: 'trackingNumber', header: this.translate.instant('shipments.trackingNumber'), sortable: true, width: '140px' },
    { field: 'shippedDate', header: this.translate.instant('shipments.shippedDate'), sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: this.translate.instant('common.createdAt'), sortable: true, type: 'date', width: '110px' },
  ];

  constructor() {
    this.loadShipments();
  }

  protected loadShipments(): void {
    this.loading.set(true);
    const status = this.statusFilterControl.value ?? undefined;
    this.shipmentService.getShipments(undefined, status).subscribe({
      next: (list) => { this.shipments.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void { this.loadShipments(); }

  protected openShipmentDetail(item: ShipmentListItem): void {
    const ref = openDetailDialog(
      this.dialog,
      ShipmentDetailDialogComponent,
      { shipmentId: item.id } satisfies ShipmentDetailDialogData,
    );
    ref.afterClosed().subscribe(() => this.loadShipments());
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadShipments();
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Pending: 'chip--muted',
      Packed: 'chip--info',
      Shipped: 'chip--primary',
      InTransit: 'chip--warning',
      Delivered: 'chip--success',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'shipments.status' + status;
    return this.translate.instant(key);
  }
}
