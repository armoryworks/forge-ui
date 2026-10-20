import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { portalAuthInterceptor } from './portal-auth.interceptor';
import { PortalService } from './portal.service';

describe('portalAuthInterceptor', () => {
  const endSession = vi.fn();
  let token: string | null;

  beforeEach(() => {
    endSession.mockReset();
    token = 'session-token';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([portalAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: PortalService, useValue: { getToken: () => token, endSession } },
      ],
    });
  });

  it('attaches the portal token to session requests', () => {
    TestBed.inject(HttpClient).get('/api/v1/portal/me/quotes').subscribe();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/portal/me/quotes');
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush([]);
  });

  it('ends the session when the API rejects the token', () => {
    TestBed.inject(HttpClient).get('/api/v1/portal/me/quotes').subscribe({ error: () => undefined });

    TestBed.inject(HttpTestingController).expectOne('/api/v1/portal/me/quotes')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(endSession).toHaveBeenCalledOnce();
  });

  it('ends the session when a session request has no live token', () => {
    token = null;
    TestBed.inject(HttpClient).get('/api/v1/portal/me/dashboard').subscribe();

    TestBed.inject(HttpTestingController).expectOne('/api/v1/portal/me/dashboard').flush({});

    expect(endSession).toHaveBeenCalledOnce();
  });

  it('leaves anonymous portal requests alone', () => {
    token = null;
    TestBed.inject(HttpClient).get('/api/v1/portal/terminology').subscribe();

    const req = TestBed.inject(HttpTestingController).expectOne('/api/v1/portal/terminology');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);

    expect(endSession).not.toHaveBeenCalled();
  });
});
