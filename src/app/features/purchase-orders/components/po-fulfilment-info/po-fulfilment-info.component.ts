import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { DropShipDeliveryDialogComponent } from '../../../sales-orders/components/drop-ship-delivery-dialog/drop-ship-delivery-dialog.component';
import { LINKED_PURCHASE_ROLES } from '../../../sales-orders/models/linked-purchase-roles.model';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';

const DELIVERABLE_STATUSES = ['Submitted', 'Acknowledged', 'PartiallyReceived'];

/**
 * The drop-ship or back-to-back side of a purchase order: its fulfilment type, the customer address a drop-ship
 * goes to, the sales order line each line buys for, and the drop-ship "Confirm delivery" action.
 */
@Component({
  selector: 'app-po-fulfilment-info',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, EntityLinkComponent, DropShipDeliveryDialogComponent],
  templateUrl: './po-fulfilment-info.component.html',
  styleUrl: './po-fulfilment-info.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoFulfilmentInfoComponent {
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);

  readonly po = input.required<PurchaseOrderDetail>();
  readonly changed = output<void>();

  protected readonly delivering = signal<PurchaseOrderLine | null>(null);
  protected readonly isDropShip = computed(() => this.po().fulfilmentType === 'DropShip');
  protected readonly linkedLines = computed(() => this.po().lines.filter(l => l.salesOrderLineId != null));
  protected readonly canConfirm = computed(() =>
    this.isDropShip() && DELIVERABLE_STATUSES.includes(this.po().status)
    && this.capabilities.isEnabled('CAP-P2P-DROPSHIP') && this.auth.hasAnyRole([...LINKED_PURCHASE_ROLES]));

  protected onDelivered(): void {
    this.delivering.set(null);
    this.changed.emit();
  }
}
