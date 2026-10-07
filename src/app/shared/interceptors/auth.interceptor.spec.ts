import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { of } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { LayoutService } from '../services/layout.service';
import { MobileAuthService } from '../services/mobile-auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const clearAuth = vi.fn();
  const refreshAccessToken = vi.fn();
  const navigate = vi.fn();

  beforeEach(() => {
    clearAuth.mockReset();
    refreshAccessToken.mockReset().mockReturnValue(of('fresh-token'));
    navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { token: () => 'session-token', isAuthenticated: () => true, clearAuth, refreshAccessToken },
        },
        { provide: MobileAuthService, useValue: { refreshAccessToken } },
        { provide: Router, useValue: { navigate, url: '/jobs' } },
        { provide: LayoutService, useValue: { isAuthRoute: () => false } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the session token when the request carries none', () => {
    http.get('/api/v1/jobs').subscribe();
    const req = httpMock.expectOne('/api/v1/jobs');
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush([]);
  });

  it('leaves an explicit Authorization header unchanged', () => {
    http.delete('/api/v1/mobile/clock/events/5', { headers: { Authorization: 'Bearer other-person' } }).subscribe();
    const req = httpMock.expectOne('/api/v1/mobile/clock/events/5');
    expect(req.request.headers.get('Authorization')).toBe('Bearer other-person');
    req.flush({});
  });

  it('does not refresh or sign out when a request with its own token gets a 401', () => {
    let failure: HttpErrorResponse | null = null;
    http.delete('/api/v1/mobile/clock/events/5', { headers: { Authorization: 'Bearer expired-person' } })
      .subscribe({ error: (err: HttpErrorResponse) => { failure = err; } });

    httpMock.expectOne('/api/v1/mobile/clock/events/5').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failure!.status).toBe(401);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
