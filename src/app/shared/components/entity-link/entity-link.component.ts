import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { EntityPreview, PreviewLink } from '../../models/entity-preview.model';
import { EntityPreviewService } from '../../services/entity-preview.service';

/**
 * Supported entity types for cross-object navigation.
 * Maps to the detail dialog `?detail=type:id` URL pattern.
 */
export type LinkableEntityType =
  | 'job' | 'part' | 'vendor' | 'purchase-order' | 'sales-order'
  | 'invoice' | 'payment' | 'shipment' | 'quote' | 'lead'
  | 'asset' | 'lot' | 'rfq' | 'customer-return' | 'training'
  | 'customer' | 'vendor-bill' | 'vendor-payment';

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
  // The lot ?detail= restore lives on /lots (lots.component.autoOpenFromUrl);
  // /quality never restored it, so lot links landed on a page with no dialog.
  'lot': '/lots',
  'rfq': '/purchasing',
  'customer-return': '/customer-returns',
  'training': '/training',
  'customer': '/customers',
  'vendor-bill': '/payables/bills',
  'vendor-payment': '/payables/payments',
};

const OPEN_DEBOUNCE_MS = 350;
const CLOSE_DEBOUNCE_MS = 150;

/**
 * Inline clickable link that navigates to a related entity's detail dialog,
 * with a hover/focus preview popover showing non-sensitive basics + jump
 * buttons to related records. Wired into the component so every existing
 * `<app-entity-link>` usage gets the preview for free.
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
  imports: [OverlayModule, TranslatePipe],
  templateUrl: './entity-link.component.html',
  styleUrl: './entity-link.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntityLinkComponent {
  private readonly router = inject(Router);
  private readonly previewService = inject(EntityPreviewService);
  private readonly destroyRef = inject(DestroyRef);

  readonly type = input.required<LinkableEntityType>();
  readonly entityId = input.required<number>();

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly preview = signal<EntityPreview | null>(null);

  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearTimer('openTimer');
      this.clearTimer('closeTimer');
    });
  }

  navigate(event: Event): void {
    event.stopPropagation();
    this.navigateTo(this.type(), this.entityId());
  }

  protected onLinkClick(event: Event, link: PreviewLink): void {
    event.stopPropagation();
    this.close();
    this.navigateTo(link.type, link.id);
  }

  protected scheduleOpen(): void {
    this.clearTimer('closeTimer');
    if (this.open() || this.openTimer !== null) return;
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.load();
    }, OPEN_DEBOUNCE_MS);
  }

  protected scheduleClose(): void {
    this.clearTimer('openTimer');
    this.clearTimer('closeTimer');
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.open.set(false);
    }, CLOSE_DEBOUNCE_MS);
  }

  protected cancelClose(): void {
    this.clearTimer('closeTimer');
  }

  protected close(): void {
    this.clearTimer('openTimer');
    this.clearTimer('closeTimer');
    this.open.set(false);
  }

  private load(): void {
    const cached = this.preview();
    if (cached) {
      this.open.set(true);
      return;
    }
    this.loading.set(true);
    this.open.set(true);
    this.previewService.getPreview(this.type(), this.entityId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.loading.set(false);
        this.preview.set(result);
        // Nothing to show (404 / error) — collapse the popover; the link still works.
        if (!result) this.open.set(false);
      });
  }

  private navigateTo(entityType: LinkableEntityType, id: number): void {
    const basePath = ENTITY_ROUTES[entityType];
    this.router.navigate([basePath], { queryParams: { detail: `${entityType}:${id}` } });
  }

  private clearTimer(which: 'openTimer' | 'closeTimer'): void {
    const t = this[which];
    if (t !== null) {
      clearTimeout(t);
      this[which] = null;
    }
  }
}
