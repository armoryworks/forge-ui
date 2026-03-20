import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

import { ShipmentService } from './services/shipment.service';
import { ShipmentListItem } from './models/shipment-list-item.model';
import { ShipmentDetail } from './models/shipment-detail.model';
import { ShipmentTracking } from './models/shipment-tracking.model';
import { ShippingLabel } from './models/shipping-label.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { MatDialog } from '@angular/material/dialog';
import { ShipmentDialogComponent } from './components/shipment-dialog/shipment-dialog.component';
import { ShippingRatesDialogComponent } from './components/shipping-rates-dialog/shipping-rates-dialog.component';
import { TrackingTimelineComponent } from './components/tracking-timeline/tracking-timeline.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-shipments',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    ShipmentDialogComponent, ShippingRatesDialogComponent, TrackingTimelineComponent,
    TranslatePipe, MatTooltipModule,
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
  protected readonly showRatesDialog = signal(false);
  protected readonly loading = signal(false);
  protected readonly shipments = signal<ShipmentListItem[]>([]);
  protected readonly selectedShipment = signal<ShipmentDetail | null>(null);
  protected readonly trackingData = signal<ShipmentTracking | null>(null);
  protected readonly trackingLoading = signal(false);

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

  protected readonly shipmentRowClass = (row: unknown) => {
    const shipment = row as ShipmentListItem;
    return shipment.id === this.selectedShipment()?.id ? 'row--selected' : '';
  };

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

  protected selectShipment(item: ShipmentListItem): void {
    this.shipmentService.getShipmentById(item.id).subscribe({
      next: (detail) => this.selectedShipment.set(detail),
    });
  }

  protected closeDetail(): void {
    this.selectedShipment.set(null);
    this.trackingData.set(null);
  }

  // --- Create Dialog ---
  protected openCreateDialog(): void { this.showCreateDialog.set(true); }
  protected closeCreateDialog(): void { this.showCreateDialog.set(false); }
  protected onCreateSaved(): void {
    this.closeCreateDialog();
    this.loadShipments();
  }

  // --- Rates Dialog ---
  protected openRatesDialog(): void { this.showRatesDialog.set(true); }
  protected closeRatesDialog(): void { this.showRatesDialog.set(false); }
  protected onLabelCreated(label: ShippingLabel): void {
    const shipment = this.selectedShipment();
    if (shipment) {
      this.refreshDetail(shipment.id);
      this.loadShipments();
    }
  }

  // --- Tracking ---
  protected loadTracking(): void {
    const shipment = this.selectedShipment();
    if (!shipment || !shipment.trackingNumber) return;
    this.trackingLoading.set(true);
    this.shipmentService.getTracking(shipment.id).subscribe({
      next: (tracking) => {
        this.trackingData.set(tracking);
        this.trackingLoading.set(false);
      },
      error: () => {
        this.trackingLoading.set(false);
        this.snackbar.error(this.translate.instant('shipments.failedTracking'));
      },
    });
  }

  protected closeTracking(): void { this.trackingData.set(null); }

  // --- Status Actions ---
  protected markShipped(): void {
    const shipment = this.selectedShipment();
    if (!shipment) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shipments.markShippedTitle'),
        message: this.translate.instant('shipments.markShippedMessage', { number: shipment.shipmentNumber }),
        confirmLabel: this.translate.instant('shipments.markShipped'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.shipShipment(shipment.id).subscribe({
        next: () => {
          this.refreshDetail(shipment.id);
          this.loadShipments();
          this.snackbar.success(this.translate.instant('shipments.shipmentShipped'));
        },
      });
    });
  }

  protected markDelivered(): void {
    const shipment = this.selectedShipment();
    if (!shipment) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shipments.markDeliveredTitle'),
        message: this.translate.instant('shipments.markDeliveredMessage', { number: shipment.shipmentNumber }),
        confirmLabel: this.translate.instant('shipments.markDelivered'),
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.deliverShipment(shipment.id).subscribe({
        next: () => {
          this.refreshDetail(shipment.id);
          this.loadShipments();
          this.snackbar.success(this.translate.instant('shipments.shipmentDelivered'));
        },
      });
    });
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

  protected canShip(status: string): boolean {
    return status === 'Pending' || status === 'Packed';
  }

  protected canDeliver(status: string): boolean {
    return status === 'Shipped' || status === 'InTransit';
  }

  private refreshDetail(id: number): void {
    this.shipmentService.getShipmentById(id).subscribe(d => this.selectedShipment.set(d));
  }
}
