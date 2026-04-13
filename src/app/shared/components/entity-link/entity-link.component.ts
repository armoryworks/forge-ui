import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Supported entity types for cross-object navigation.
 * Maps to the detail dialog `?detail=type:id` URL pattern.
 */
export type LinkableEntityType =
  | 'job' | 'part' | 'vendor' | 'purchase-order' | 'sales-order'
  | 'invoice' | 'payment' | 'shipment' | 'quote' | 'lead'
  | 'asset' | 'lot' | 'rfq' | 'customer-return' | 'training'
  | 'customer';

/** Route base path for each entity type. */
const ENTITY_ROUTES: Record<LinkableEntityType, string> = {
  'job': '/kanban',
  'part': '/parts',
  'vendor': '/vendors',
  'purchase-order': '/purchase-orders',
  'sales-order': '/sales-orders',
  'invoice': '/invoices',
  'payment': '/payments',
  'shipment': '/shipments',
  'quote': '/quotes',
  'lead': '/leads',
  'asset': '/assets',
  'lot': '/quality',
  'rfq': '/purchasing',
  'customer-return': '/customer-returns',
  'training': '/training',
  'customer': '/customers',
};

/**
 * Inline clickable link that navigates to a related entity's detail dialog.
 *
 * Usage:
 * ```html
 * <app-entity-link type="vendor" [entityId]="po.vendorId">{{ po.vendorName }}</app-entity-link>
 * <app-entity-link type="purchase-order" [entityId]="rfq.generatedPurchaseOrderId">PO #{{ rfq.generatedPurchaseOrderId }}</app-entity-link>
 * ```
 */
@Component({
  selector: 'app-entity-link',
  standalone: true,
  template: `<a class="entity-link" (click)="navigate($event)" (keydown.enter)="navigate($event)" tabindex="0" role="link"><ng-content /></a>`,
  styleUrl: './entity-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityLinkComponent {
  private readonly router = inject(Router);

  readonly type = input.required<LinkableEntityType>();
  readonly entityId = input.required<number>();

  navigate(event: Event): void {
    event.stopPropagation();

    const entityType = this.type();
    const id = this.entityId();
    const basePath = ENTITY_ROUTES[entityType];

    if (entityType === 'customer') {
      this.router.navigate(['/customers', id, 'overview']);
    } else {
      this.router.navigate([basePath], { queryParams: { detail: `${entityType}:${id}` } });
    }
  }
}
