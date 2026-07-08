import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ShipmentDialogComponent } from '../shipments/components/shipment-dialog/shipment-dialog.component';
import { ShippingService } from './services/shipping.service';
import { ReadyToShipOrder } from './models/ready-to-ship-order.model';

/**
 * Shipping fulfillment workspace — the operational "what needs to ship" home. Shows the
 * ready-to-ship queue (open orders with unshipped line quantity) and lets an operator create a
 * shipment per order (reusing the shipment dialog, which flows into rate/label/mark-shipped).
 * The Shipments *history* lives under Sales; this is the doing surface.
 */
@Component({
  selector: 'app-shipping',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, TranslatePipe, PageLayoutComponent, EmptyStateComponent, ShipmentDialogComponent],
  templateUrl: './shipping.component.html',
  styleUrl: './shipping.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShippingComponent {
  private readonly service = inject(ShippingService);

  protected readonly orders = signal<ReadyToShipOrder[]>([]);
  protected readonly loading = signal(false);
  /** The sales-order id currently being shipped (drives the inline shipment dialog), or null when closed. */
  protected readonly shipOrderId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getReadyToShip().subscribe({
      next: (o) => { this.orders.set(o); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openShip(order: ReadyToShipOrder): void {
    this.shipOrderId.set(order.salesOrderId);
  }

  protected onDialogClosed(): void {
    this.shipOrderId.set(null);
  }

  protected onDialogSaved(): void {
    this.shipOrderId.set(null);
    this.load();
  }
}
