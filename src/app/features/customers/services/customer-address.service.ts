import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CustomerAddress } from '../../../shared/models/customer-address.model';
import { CreateCustomerAddressRequest } from '../../../shared/models/create-customer-address-request.model';
import { UpdateCustomerAddressRequest } from '../../../shared/models/update-customer-address-request.model';

/**
 * CRUD against CustomerAddressesController
 * (`/api/v1/customers/{customerId}/addresses`). Backs the Addresses tab
 * cluster on the customer detail page; the customer-creation workflow
 * defers address entry here (see CustomerAddressesStepComponent).
 */
@Injectable({ providedIn: 'root' })
export class CustomerAddressService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/customers`;

  getAddresses(customerId: number, includeInactive = false): Observable<CustomerAddress[]> {
    // includeInactive is honored server-side only for Admins (F3 address history).
    let params = new HttpParams();
    if (includeInactive) params = params.set('includeInactive', 'true');
    return this.http.get<CustomerAddress[]>(`${this.base}/${customerId}/addresses`, { params });
  }

  createAddress(customerId: number, request: CreateCustomerAddressRequest): Observable<CustomerAddress> {
    return this.http.post<CustomerAddress>(`${this.base}/${customerId}/addresses`, request);
  }

  updateAddress(customerId: number, addressId: number, request: UpdateCustomerAddressRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${customerId}/addresses/${addressId}`, request);
  }

  deleteAddress(customerId: number, addressId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${customerId}/addresses/${addressId}`);
  }

  /** Admin-only active/inactive toggle (F3 address history). */
  setAddressActive(customerId: number, addressId: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.base}/${customerId}/addresses/${addressId}/active`, { isActive });
  }
}
