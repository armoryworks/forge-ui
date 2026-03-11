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

@Component({
  selector: 'app-shipments',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, CurrencyPipe,
    PageHeaderComponent, InputComponent, SelectComponent,
    DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    ShipmentDialogComponent, ShippingRatesDialogComponent, TrackingTimelineComponent,
  ],
  templateUrl: './shipments.component.html',
  styleUrl: './shipments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipmentsComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

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
    { value: null, label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Packed', label: 'Packed' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'InTransit', label: 'In Transit' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  protected readonly shipmentColumns: ColumnDef[] = [
    { field: 'shipmentNumber', header: 'Shipment #', sortable: true, width: '120px' },
    { field: 'salesOrderNumber', header: 'SO #', sortable: true, width: '120px' },
    { field: 'customerName', header: 'Customer', sortable: true },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '120px', filterOptions: [
      { value: 'Pending', label: 'Pending' },
      { value: 'Packed', label: 'Packed' },
      { value: 'Shipped', label: 'Shipped' },
      { value: 'InTransit', label: 'In Transit' },
      { value: 'Delivered', label: 'Delivered' },
      { value: 'Cancelled', label: 'Cancelled' },
    ]},
    { field: 'carrier', header: 'Carrier', sortable: true, width: '100px' },
    { field: 'trackingNumber', header: 'Tracking #', sortable: true, width: '140px' },
    { field: 'shippedDate', header: 'Shipped', sortable: true, type: 'date', width: '110px' },
    { field: 'createdAt', header: 'Created', sortable: true, type: 'date', width: '110px' },
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
        this.snackbar.error('Failed to load tracking info.');
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
        title: 'Mark as Shipped?',
        message: `Mark "${shipment.shipmentNumber}" as shipped? This will record the current date as the shipped date.`,
        confirmLabel: 'Mark Shipped',
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.shipShipment(shipment.id).subscribe({
        next: () => {
          this.refreshDetail(shipment.id);
          this.loadShipments();
          this.snackbar.success('Shipment marked as shipped.');
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
        title: 'Mark as Delivered?',
        message: `Mark "${shipment.shipmentNumber}" as delivered?`,
        confirmLabel: 'Mark Delivered',
        severity: 'info',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.shipmentService.deliverShipment(shipment.id).subscribe({
        next: () => {
          this.refreshDetail(shipment.id);
          this.loadShipments();
          this.snackbar.success('Shipment marked as delivered.');
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
    return status === 'InTransit' ? 'In Transit' : status;
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
