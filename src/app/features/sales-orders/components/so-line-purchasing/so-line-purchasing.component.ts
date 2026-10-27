import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { DropShipDeliveryDialogComponent } from '../drop-ship-delivery-dialog/drop-ship-delivery-dialog.component';
import { LinkedPurchaseDialogComponent } from '../linked-purchase-dialog/linked-purchase-dialog.component';
import { LINKED_PURCHASE_ROLES } from '../../models/linked-purchase-roles.model';
import { LinkedPurchaseType } from '../../models/linked-purchase-type.type';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { SalesOrderLinePurchase } from '../../models/sales-order-line-purchase.model';

const BUYABLE_STATUSES = ['Confirmed', 'InProduction', 'PartiallyShipped'];
const DELIVERABLE_PO_STATUSES = ['Submitted', 'Acknowledged', 'PartiallyReceived'];

/**
 * The purchasing strip under a sales order line: the drop-ship and back-to-back POs bought for it, with their
 * status and received quantity, and the actions to raise one or confirm a vendor's drop-ship delivery.
 */
@Component({
  selector: 'app-so-line-purchasing',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, EntityLinkComponent, LinkedPurchaseDialogComponent, DropShipDeliveryDialogComponent],
  templateUrl: './so-line-purchasing.component.html',
  styleUrl: './so-line-purchasing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoLinePurchasingComponent {
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);

  readonly salesOrderId = input.required<number>();
  readonly line = input.required<SalesOrderLine>();
  readonly orderStatus = input.required<string>();
  readonly changed = output<void>();

  protected readonly buying = signal<LinkedPurchaseType | null>(null);
  protected readonly delivering = signal<SalesOrderLinePurchase | null>(null);

  private readonly hasRole = computed(() => this.auth.hasAnyRole([...LINKED_PURCHASE_ROLES]));
  protected readonly canDropShip = computed(() => this.hasRole() && this.capabilities.isEnabled('CAP-P2P-DROPSHIP'));
  protected readonly canBackToBack = computed(() => this.hasRole() && this.capabilities.isEnabled('CAP-P2P-BACKTOBACK'));

  protected readonly purchases = computed(() => (this.line().purchases ?? []).filter(p => p.status !== 'Cancelled'));

  /** What the line still needs: ordered, less what shipped from our own stock, less what live POs cover. */
  protected readonly openQuantity = computed(() => {
    const line = this.line();
    const purchases = this.purchases();
    const covered = purchases.reduce((sum, p) => sum + p.orderedQuantity, 0);
    const dropShipped = purchases.filter(p => p.fulfilmentType === 'DropShip').reduce((sum, p) => sum + p.receivedQuantity, 0);
    const shippedFromStock = Math.max(0, line.shippedQuantity - dropShipped);
    return Math.max(0, Math.round((line.quantity - shippedFromStock - covered) * 10000) / 10000);
  });

  protected readonly canBuy = computed(() =>
    BUYABLE_STATUSES.includes(this.orderStatus()) && this.line().shipsGoods !== false && this.openQuantity() > 0);

  protected canConfirmDelivery(purchase: SalesOrderLinePurchase): boolean {
    return this.canDropShip() && purchase.fulfilmentType === 'DropShip'
      && purchase.remainingQuantity > 0 && DELIVERABLE_PO_STATUSES.includes(purchase.status);
  }

  protected readyToShip(purchase: SalesOrderLinePurchase): boolean {
    return purchase.fulfilmentType === 'BackToBack' && purchase.receivedQuantity > 0 && purchase.remainingQuantity <= 0;
  }

  protected openBuy(type: LinkedPurchaseType): void {
    this.buying.set(type);
  }

  protected onBought(): void {
    this.buying.set(null);
    this.changed.emit();
  }

  protected onDelivered(): void {
    this.delivering.set(null);
    this.changed.emit();
  }
}
