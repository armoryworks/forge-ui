import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';

interface CustomerAddress {
  id: number;
  type: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

/**
 * Wave 6 — Customer Addresses cluster.
 *
 * Read-only address list (CRUD goes through CustomerAddressesController
 * with its own dialog flows; the cluster currently surfaces just the
 * list). Mounted into the Addresses tab on the customer detail page.
 *
 * Was previously `CustomerAddressesTabComponent` at
 * `pages/customer-detail/tabs/`. Moved to `components/customer-clusters/`
 * + renamed to match the cluster naming convention. Visible UX unchanged.
 *
 * Gated server-side and in the parent layout by CAP-MD-CUSTOMER-ADDRESSES;
 * the customer-create flow writes a single primary address directly via
 * CreateCustomerCommand, bypassing this cluster entirely for single-
 * address shops.
 */
@Component({
  selector: 'app-customer-addresses-cluster',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './customer-addresses-cluster.component.html',
  styleUrl: '../../pages/customer-detail/customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressesClusterComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly customerId = input.required<number>();

  protected readonly addresses = signal<CustomerAddress[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<CustomerAddress[]>(`${environment.apiUrl}/customers/${this.customerId()}/addresses`)
      .subscribe({
        next: data => { this.addresses.set(data); this.loading.set(false); },
        error: () => { this.addresses.set([]); this.loading.set(false); },
      });
  }
}
