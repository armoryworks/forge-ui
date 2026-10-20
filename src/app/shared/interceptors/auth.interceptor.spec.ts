import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { of } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { MobileAuthService } from '../services/mobile-auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const clearAuth = vi.fn();
  const refreshAccessToken = vi.fn();
  const redirectToLogin = vi.fn();

  beforeEach(() => {
    clearAuth.mockReset();
    refreshAccessToken.mockReset().mockReturnValue(of('fresh-token'));
    redirectToLogin.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { token: () => 'session-token', isAuthenticated: () => true, clearAuth, refreshAccessToken, redirectToLogin },
        },
        { provide: MobileAuthService, useValue: { refreshAccessToken } },
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
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('signs out and hands the session-expired redirect to the auth service when refresh fails', () => {
    refreshAccessToken.mockReturnValue(of(null));
    let failure: HttpErrorResponse | null = null;
    http.get('/api/v1/jobs').subscribe({ error: (err: HttpErrorResponse) => { failure = err; } });

    httpMock.expectOne('/api/v1/jobs').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failure!.status).toBe(401);
    expect(clearAuth).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledWith('session_expired');
  });

  it('keeps the session when the retried request fails for another reason', () => {
    let failure: HttpErrorResponse | null = null;
    http.get('/api/v1/jobs').subscribe({ error: (err: HttpErrorResponse) => { failure = err; } });

    httpMock.expectOne('/api/v1/jobs').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/v1/jobs').flush(null, { status: 500, statusText: 'Server Error' });

    expect(failure!.status).toBe(500);
    expect(clearAuth).not.toHaveBeenCalled();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('leaves the employee session alone when a portal call gets a 401', () => {
    let failure: HttpErrorResponse | null = null;
    http.get('/api/v1/portal/me/quotes').subscribe({ error: (err: HttpErrorResponse) => { failure = err; } });

    const req = httpMock.expectOne('/api/v1/portal/me/quotes');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(failure!.status).toBe(401);
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
