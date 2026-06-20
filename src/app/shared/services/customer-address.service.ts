import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CustomerAddress } from '../models/customer-address.model';
import { CreateCustomerAddressRequest } from '../models/create-customer-address-request.model';

/** CRUD for a customer's saved addresses (GET/POST /customers/{customerId}/addresses). */
@Injectable({ providedIn: 'root' })
export class CustomerAddressService {
  private readonly http = inject(HttpClient);

  private base(customerId: number): string {
    return `${environment.apiUrl}/customers/${customerId}/addresses`;
  }

  list(customerId: number): Observable<CustomerAddress[]> {
    return this.http.get<CustomerAddress[]>(this.base(customerId));
  }

  create(customerId: number, request: CreateCustomerAddressRequest): Observable<CustomerAddress> {
    return this.http.post<CustomerAddress>(this.base(customerId), request);
  }
}
