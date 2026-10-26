import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { ShipmentService } from '../../services/shipment.service';
import { Address, AddressValidationResult } from '../../../../shared/models/address.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

const COMPARED_FIELDS: readonly (keyof Address)[] = ['line1', 'city', 'state', 'postalCode'];

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/**
 * "Validate address" for a shipment's ship-to. Sends the address to the carrier address service and, when it
 * comes back standardized differently, shows the suggestion with a choice to use it or keep the address as
 * entered.
 */
@Component({
  selector: 'app-ship-to-validation',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './ship-to-validation.component.html',
  styleUrl: './ship-to-validation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShipToValidationComponent {
  private readonly shipmentService = inject(ShipmentService);
  private readonly snackbar = inject(SnackbarService);

  readonly address = input<Address | null>(null);
  readonly accepted = output<Address>();

  protected readonly validating = signal(false);
  protected readonly result = signal<AddressValidationResult | null>(null);

  protected readonly complete = computed(() => {
    const a = this.address();
    return !!a && !!a.line1?.trim() && !!a.city?.trim() && !!a.state?.trim() && !!a.postalCode?.trim();
  });

  protected readonly suggestion = computed<Address | null>(() => {
    const r = this.result();
    const a = this.address();
    if (!r?.isValid || !a) return null;
    const suggested: Address = {
      line1: r.street ?? a.line1,
      line2: a.line2 ?? null,
      city: r.city ?? a.city,
      state: r.state ?? a.state,
      postalCode: r.zip ?? a.postalCode,
      country: r.country ?? a.country,
    };
    const same = COMPARED_FIELDS.every((k) => normalize(suggested[k]) === normalize(a[k]));
    return same ? null : suggested;
  });

  constructor() {
    effect(() => {
      this.address();
      untracked(() => this.result.set(null));
    });
  }

  protected validate(): void {
    const a = this.address();
    if (!a || !this.complete() || this.validating()) return;
    this.validating.set(true);
    this.shipmentService.validateAddress(a).subscribe({
      next: r => { this.validating.set(false); this.result.set(r); },
      error: (err: unknown) => { this.validating.set(false); this.snackbar.errorFrom(err, 'shipments.validateAddress.failed'); },
    });
  }

  protected useSuggestion(): void {
    const s = this.suggestion();
    if (!s) return;
    this.accepted.emit(s);
    this.result.set(null);
  }

  protected keep(): void {
    this.result.set(null);
  }
}
