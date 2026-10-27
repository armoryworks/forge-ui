import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { TranslatePipe } from '@ngx-translate/core';

import { DateOnlyPipe } from '../../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { fromIsoDate } from '../../../../shared/utils/date.utils';
import { InventoryService } from '../../services/inventory.service';
import { AtpResult } from '../../models/atp.model';
import { ATP_ROLES } from '../../models/atp-roles.model';

/**
 * "Available to promise" check for a sales order line being entered: for the part and quantity, the earliest
 * date the quantity can be met and whether that is on or before the order's requested date. When the line
 * already exists its own open quantity is left out of the demand.
 */
@Component({
  selector: 'app-atp-check',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, DateOnlyPipe],
  templateUrl: './atp-check.component.html',
  styleUrl: './atp-check.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtpCheckComponent {
  private readonly inventoryService = inject(InventoryService);
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);

  readonly partId = input<number | null>(null);
  readonly quantity = input<number | null>(null);
  readonly requestedDate = input<Date | string | null>(null);
  readonly salesOrderLineId = input<number | null>(null);

  protected readonly visible = computed(() =>
    this.capabilities.isEnabled('CAP-INV-CORE') && this.capabilities.isEnabled('CAP-PLAN-ATP') && this.auth.hasAnyRole([...ATP_ROLES]));
  protected readonly canCheck = computed(() => this.partId() != null && (this.quantity() ?? 0) > 0);
  protected readonly checking = signal(false);
  protected readonly result = signal<AtpResult | null>(null);

  protected readonly verdict = computed<'onTime' | 'late' | 'short' | 'available' | null>(() => {
    const r = this.result();
    if (!r) return null;
    if (!r.earliestAvailableDate) return 'short';
    const requested = fromIsoDate(this.requestedDate());
    if (!requested) return 'available';
    const earliest = fromIsoDate(r.earliestAvailableDate);
    return earliest && earliest.getTime() <= requested.getTime() ? 'onTime' : 'late';
  });

  constructor() {
    effect(() => {
      this.partId();
      this.quantity();
      this.result.set(null);
    });
  }

  protected check(): void {
    const partId = this.partId();
    const quantity = this.quantity();
    if (partId == null || !quantity || quantity <= 0 || this.checking()) return;
    this.checking.set(true);
    this.inventoryService.getAtp(partId, quantity, this.salesOrderLineId() ?? undefined).subscribe({
      next: result => { this.result.set(result); this.checking.set(false); },
      error: () => this.checking.set(false),
    });
  }
}
