import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Address, AddressValidationResult } from '../models/address.model';

@Injectable({ providedIn: 'root' })
export class AddressService {
  private readonly http = inject(HttpClient);

  validate(address: Address): Observable<AddressValidationResult> {
    return this.http.post<AddressValidationResult>(
      `${environment.apiUrl}/addresses/validate`,
      {
        street: address.line1,
        city: address.city,
        state: address.state,
        zip: address.postalCode,
        country: address.country,
      });
  }
}
