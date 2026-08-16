import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CommunicationService } from './communication.service';
import { environment } from '../../../../environments/environment';

describe('CommunicationService', () => {
  let service: CommunicationService;
  let httpMock: HttpTestingController;

  const base = `${environment.apiUrl}/communications`;
  const orders = `${environment.apiUrl}/sales-orders`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CommunicationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches a communication with its evidence', () => {
    service.getDetail(7).subscribe((d) => {
      expect(d.artifacts.length).toBe(2);
      expect(d.matchConfidence).toBe('Exact');
    });

    const req = httpMock.expectOne(`${base}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 7, matchConfidence: 'Exact',
      artifacts: [{ id: 1 }, { id: 2 }], links: [], priorAgreements: [], thread: [],
    });
  });

  it('posts the reviewer line values on approve', () => {
    service.approveDraft(7, {
      customerId: 3,
      authorizingArtifactId: 11,
      customerPo: '8832',
      requestedDeliveryDate: null,
      taxRate: 0.06,
      supportedByAttestationId: 91,
      note: null,
      lines: [{ partId: null, description: 'PN-1234', quantity: 250, unitPrice: 12.5, notes: null }],
    }).subscribe();

    const req = httpMock.expectOne(`${base}/7/approve-draft`);
    expect(req.request.method).toBe('POST');
    // The corrected quantity, not whatever extraction proposed — otherwise the
    // review would be cosmetic.
    expect(req.request.body.lines[0].quantity).toBe(250);
    expect(req.request.body.authorizingArtifactId).toBe(11);
    expect(req.request.body.supportedByAttestationId).toBe(91);
    req.flush({ salesOrderId: 42, orderNumber: 'SO-00042', attestationId: 99 });
  });

  it('returns null authorization for an order with no proof behind it', () => {
    // Most orders were keyed in or converted from a quote. The absence is
    // information, not an error.
    service.getAuthorization(42).subscribe((a) => expect(a).toBeNull());

    const req = httpMock.expectOne(`${orders}/42/authorization`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('returns the full digest, not a truncated one', () => {
    const full = 'ab3f91'.padEnd(64, '0');

    service.getAuthorization(42).subscribe((a) => {
      // The UI shortens for display, but verifying a hash needs all 64 chars.
      expect(a!.sha256).toHaveLength(64);
      expect(a!.sha256).toBe(full);
    });

    httpMock.expectOne(`${orders}/42/authorization`).flush({
      attestationId: 9, sha256: full, authorizationChain: [],
    });
  });
});
