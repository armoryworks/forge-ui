import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../../../environments/environment';
import { AddressFormComponent } from '../../../../../shared/components/address-form/address-form.component';

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

@Component({
  selector: 'app-customer-addresses-tab',
  standalone: true,
  imports: [AddressFormComponent],
  templateUrl: './customer-addresses-tab.component.html',
  styleUrl: '../customer-detail-tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerAddressesTabComponent implements OnInit {
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
