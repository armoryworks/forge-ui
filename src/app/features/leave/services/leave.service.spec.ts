import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { LeaveService } from './leave.service';
import { environment } from '../../../../environments/environment';

describe('LeaveService', () => {
  let service: LeaveService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/leave`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('updates a policy with PUT', () => {
    service.updatePolicy(4, {
      name: 'PTO', accrualRatePerPayPeriod: 3, maxBalance: 80, carryOverLimit: 40,
      accrueFromHireDate: true, waitingPeriodDays: 90, isPaidLeave: true, isActive: true,
    }).subscribe();
    const req = httpMock.expectOne(`${base}/policies/4`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.waitingPeriodDays).toBe(90);
    req.flush({});
  });

  it('posts a balance adjustment for the employee', () => {
    service.adjustBalance(7, { policyId: 2, type: 'Opening', hours: 24, effectiveDate: '2026-10-01' }).subscribe();
    const req = httpMock.expectOne(`${base}/balances/7/adjust`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ policyId: 2, type: 'Opening', hours: 24, effectiveDate: '2026-10-01' });
    req.flush({});
  });

  it('filters requests by status and cancels with POST', () => {
    service.getRequests(null, 'Pending').subscribe();
    const list = httpMock.expectOne(r => r.url === `${base}/requests`);
    expect(list.request.params.get('status')).toBe('Pending');
    expect(list.request.params.has('userId')).toBe(false);
    list.flush([]);

    service.cancelRequest(9).subscribe();
    const cancel = httpMock.expectOne(`${base}/requests/9/cancel`);
    expect(cancel.request.method).toBe('POST');
    cancel.flush(null);
  });

  it('sends the denial note', () => {
    service.denyRequest(3, 'Short-staffed').subscribe();
    const req = httpMock.expectOne(`${base}/requests/3/deny`);
    expect(req.request.body).toEqual({ reason: 'Short-staffed' });
    req.flush(null);
  });
});
