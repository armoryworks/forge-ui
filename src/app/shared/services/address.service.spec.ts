import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { Address, AddressValidationResult } from '../models/address.model';
import { AddressService } from './address.service';

describe('AddressService', () => {
  let service: AddressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AddressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── validate() ──────────────────────────────────────────────────────────────

  it('validate() POSTs to the correct endpoint', () => {
    const address: Address = {
      line1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
    };

    service.validate(address).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/addresses/validate`);
    expect(req.request.method).toBe('POST');
    req.flush({ isValid: true, messages: [] } satisfies AddressValidationResult);
  });

  it('validate() maps Address fields correctly (line1→street, postalCode→zip)', () => {
    const address: Address = {
      line1: '456 Oak Ave',
      line2: 'Suite 100',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'US',
    };

    service.validate(address).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/addresses/validate`);
    expect(req.request.body).toEqual({
      street: '456 Oak Ave',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
      country: 'US',
    });
    // line2 is NOT included in the body per the service implementation
    expect(req.request.body).not.toHaveProperty('line2');
    req.flush({ isValid: true, messages: [] } satisfies AddressValidationResult);
  });

  it('validate() returns the validation result from the API', () => {
    const address: Address = {
      line1: '789 Elm St',
      city: 'Decatur',
      state: 'IL',
      postalCode: '62521',
      country: 'US',
    };

    const mockResult: AddressValidationResult = {
      isValid: true,
      street: '789 ELM ST',
      city: 'DECATUR',
      state: 'IL',
      zip: '62521',
      country: 'US',
      messages: [],
    };

    let result: AddressValidationResult | undefined;
    service.validate(address).subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/addresses/validate`);
    req.flush(mockResult);

    expect(result).toEqual(mockResult);
  });

  it('validate() returns isValid false with messages when address is invalid', () => {
    const address: Address = {
      line1: '000 Fake St',
      city: 'Nowhere',
      state: 'XX',
      postalCode: '00000',
      country: 'US',
    };

    const mockResult: AddressValidationResult = {
      isValid: false,
      messages: ['Address not found', 'Invalid state code'],
    };

    let result: AddressValidationResult | undefined;
    service.validate(address).subscribe(r => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/addresses/validate`);
    req.flush(mockResult);

    expect(result?.isValid).toBe(false);
    expect(result?.messages).toHaveLength(2);
  });
});
